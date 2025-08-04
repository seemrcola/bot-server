/**
 * 意图分析器 - 负责将用户消息分解为多个子任务
 */

import {
  IntentAnalysisResult,
  SubTask,
  TaskType,
  TaskPriority,
  IntentAnalyzerConfig
} from '../types/intent.types.js';
import { LLMNLPProcessor } from '../llm/index.js';
import { createMCPLogger } from '../utils/logger.js';
import { MCPError } from '../utils/errors.js';
import { getIntentAnalysisPrompt } from './system-prompts.js';

const logger = createMCPLogger('IntentAnalyzer');

export class IntentAnalyzer {
  private llmProcessor: LLMNLPProcessor;
  private config: IntentAnalyzerConfig;
  private availableTools: Array<{name: string, description: string}> = [];

  constructor(
    llmProcessor: LLMNLPProcessor,
    availableTools: string[] = [],
    config: Partial<IntentAnalyzerConfig> = {}
  ) {
    this.llmProcessor = llmProcessor;
    // 将字符串数组转换为对象数组（暂时没有描述）
    this.availableTools = availableTools.map(name => ({ name, description: `工具: ${name}` }));
    this.config = {
      maxSubTasks: 10,
      minConfidence: 0.6,
      enableParallelExecution: true,
      taskTimeout: 30000,
      enableContextAware: true,
      toolCallTimeout: 10000,
      ...config
    };
  }

  /**
   * 分析用户消息并生成子任务列表
   */
  async analyzeIntent(
    message: string,
    context?: any
  ): Promise<IntentAnalysisResult> {
    try {
      logger.info('开始分析用户意图', { message, availableTools: this.availableTools.length });

      const prompt = getIntentAnalysisPrompt(message, this.availableTools);
      const llmResponse = await this.llmProcessor.generateText(prompt);
      
      logger.debug('LLM意图分析响应', { response: llmResponse });

      const analysisResult = this.parseLLMResponse(message, llmResponse);

      logger.debug('原始分析结果', {
        subTasksCount: analysisResult.subTasks.length,
        overallType: analysisResult.overallType,
        confidence: analysisResult.confidence,
        subTasks: analysisResult.subTasks.map(t => ({
          id: t.id,
          content: t.content,
          type: t.type,
          needsTool: t.needsTool
        }))
      });

      // 验证和优化分析结果
      const validatedResult = this.validateAndOptimizeResult(analysisResult);
      
      logger.info('意图分析完成', {
        subTasksCount: validatedResult.subTasks.length,
        overallType: validatedResult.overallType,
        confidence: validatedResult.confidence
      });

      return validatedResult;
    } catch (error) {
      logger.error('意图分析失败', error);
      // 返回一个默认的简单任务
      return this.createFallbackResult(message);
    }
  }



  /**
   * 解析LLM响应
   */
  private parseLLMResponse(originalMessage: string, response: string): IntentAnalysisResult {
    try {
      // 尝试提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法从响应中提取JSON');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // 为每个子任务生成ID（如果没有的话）
      const subTasks: SubTask[] = parsed.subTasks.map((task: any, index: number) => ({
        id: task.id || `task_${index + 1}`,
        content: task.content || '',
        type: task.type || TaskType.SIMPLE_CHAT,
        needsTool: Boolean(task.needsTool),
        suggestedTools: Array.isArray(task.suggestedTools) ? task.suggestedTools : [],
        priority: task.priority || TaskPriority.NORMAL,
        order: task.order || (index + 1),
        canParallel: Boolean(task.canParallel),
        dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
        expectedOutputType: task.expectedOutputType || 'text'
      }));

      return {
        originalMessage,
        subTasks,
        overallType: parsed.overallType || this.determineOverallType(subTasks),
        hasToolTasks: subTasks.some(task => task.needsTool),
        hasSimpleTasks: subTasks.some(task => !task.needsTool),
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.7)),
        timestamp: Date.now()
      };
    } catch (error) {
      logger.warn('解析LLM响应失败，使用默认解析', error);
      throw error;
    }
  }

  /**
   * 确定整体任务类型
   */
  private determineOverallType(subTasks: SubTask[]): TaskType {
    const hasToolTasks = subTasks.some(task => task.needsTool);
    const hasSimpleTasks = subTasks.some(task => !task.needsTool);

    if (hasToolTasks && hasSimpleTasks) {
      return TaskType.HYBRID;
    } else if (hasToolTasks) {
      return TaskType.TOOL_CALL;
    } else {
      return TaskType.SIMPLE_CHAT;
    }
  }

  /**
   * 验证和优化分析结果
   */
  private validateAndOptimizeResult(result: IntentAnalysisResult): IntentAnalysisResult {
    // 限制子任务数量
    if (result.subTasks.length > this.config.maxSubTasks) {
      logger.warn(`子任务数量超过限制，截取前${this.config.maxSubTasks}个`);
      result.subTasks = result.subTasks.slice(0, this.config.maxSubTasks);
    }

    // 验证置信度
    if (result.confidence < this.config.minConfidence) {
      logger.warn(`分析置信度过低: ${result.confidence}，降级为简单任务`);
      return this.createFallbackResult(result.originalMessage);
    }

    // 验证工具建议
    result.subTasks.forEach(task => {
      if (task.suggestedTools) {
        task.suggestedTools = task.suggestedTools.filter(tool => 
          this.availableTools.some(availableTool => availableTool.name === tool)
        );
      }
    });

    // 重新计算整体类型
    result.overallType = this.determineOverallType(result.subTasks);
    result.hasToolTasks = result.subTasks.some(task => task.needsTool);
    result.hasSimpleTasks = result.subTasks.some(task => !task.needsTool);

    return result;
  }

  /**
   * 创建降级结果（当分析失败时）
   */
  private createFallbackResult(message: string): IntentAnalysisResult {
    // 不要直接使用原始消息作为任务内容，而是创建一个处理指令
    const fallbackTask: SubTask = {
      id: 'fallback_task',
      content: `请回复用户的请求：${message}`,
      type: TaskType.SIMPLE_CHAT,
      needsTool: false,
      priority: TaskPriority.NORMAL,
      order: 1,
      canParallel: false,
      expectedOutputType: 'text'
    };

    logger.warn('使用降级处理模式', {
      originalMessage: message,
      reason: '意图分析失败或置信度过低'
    });

    return {
      originalMessage: message,
      subTasks: [fallbackTask],
      overallType: TaskType.SIMPLE_CHAT,
      hasToolTasks: false,
      hasSimpleTasks: true,
      confidence: 0.5,
      timestamp: Date.now()
    };
  }

  /**
   * 更新可用工具列表
   */
  updateAvailableTools(tools: string[]): void {
    this.availableTools = tools.map(name => ({ name, description: `工具: ${name}` }));
    logger.info('更新可用工具列表', { toolsCount: tools.length });
  }

  /**
   * 更新可用工具列表（包含描述）
   */
  updateAvailableToolsWithDescriptions(tools: Array<{name: string, description: string}>): void {
    this.availableTools = tools;
    logger.info('更新可用工具列表（含描述）', { toolsCount: tools.length });
  }

  /**
   * 获取配置
   */
  getConfig(): IntentAnalyzerConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<IntentAnalyzerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('更新意图分析器配置', newConfig);
  }
}
