/**
 * 任务执行器 - 负责执行不同类型的子任务并合并结果
 */

import {
  SubTask,
  TaskType,
  TaskExecutionResult,
  TaskExecutorConfig,
  HybridProcessingResult,
  IntentAnalysisResult
} from '../types/intent.types.js';
import { LLMNLPProcessor } from '../llm/index.js';
import { MCPClient } from '../client/mcp-client.js';
import { createMCPLogger } from '../utils/logger.js';
import { MCPError } from '../utils/errors.js';
import { getSimpleTaskPrompt, getFinalResponsePrompt } from './system-prompts.js';


const logger = createMCPLogger('TaskExecutor');

export class TaskExecutor {
  private llmProcessor: LLMNLPProcessor;
  private toolToClientMap: Map<string, MCPClient>;
  private config: TaskExecutorConfig;
  private taskCache: Map<string, TaskExecutionResult> = new Map();

  constructor(
    llmProcessor: LLMNLPProcessor,
    toolToClientMap: Map<string, MCPClient>,
    config: Partial<TaskExecutorConfig> = {}
  ) {
    this.llmProcessor = llmProcessor;
    this.toolToClientMap = toolToClientMap;
    this.config = {
      maxParallelTasks: 3,
      maxRetries: 2,
      retryDelay: 1000,
      enableTaskCache: true,
      cacheExpiration: 300000, // 5分钟
      ...config
    };
  }

  /**
   * 执行意图分析结果中的所有任务
   */
  async executeIntentAnalysis(
    analysisResult: IntentAnalysisResult,
    context?: any
  ): Promise<HybridProcessingResult> {
    const startTime = Date.now();
    logger.info('开始执行任务集合', {
      taskCount: analysisResult.subTasks.length,
      overallType: analysisResult.overallType
    });

    try {
      // 按依赖关系和优先级排序任务
      const sortedTasks = this.sortTasksByDependencies(analysisResult.subTasks);
      
      // 执行任务
      const taskResults = await this.executeTasks(sortedTasks, context);
      
      // 生成最终响应
      const finalResponse = await this.generateFinalResponse(
        analysisResult,
        taskResults
      );

      const result: HybridProcessingResult = {
        originalMessage: analysisResult.originalMessage,
        intentAnalysis: analysisResult,
        taskResults,
        finalResponse,
        success: taskResults.every(r => r.success),
        totalDuration: Date.now() - startTime,
        timestamp: Date.now()
      };

      logger.info('任务集合执行完成', {
        success: result.success,
        duration: result.totalDuration,
        taskCount: taskResults.length
      });

      return result;
    } catch (error) {
      logger.error('任务集合执行失败', error);
      throw MCPError.executionError('任务执行失败', error);
    }
  }

  /**
   * 按依赖关系和优先级排序任务
   */
  private sortTasksByDependencies(tasks: SubTask[]): SubTask[] {
    const sorted: SubTask[] = [];
    const remaining = [...tasks];
    const processed = new Set<string>();

    // 简单的拓扑排序
    while (remaining.length > 0) {
      const readyTasks = remaining.filter(task => 
        !task.dependencies || 
        task.dependencies.every(dep => processed.has(dep))
      );

      if (readyTasks.length === 0) {
        // 如果有循环依赖，按order排序
        logger.warn('检测到可能的循环依赖，按order排序');
        remaining.sort((a, b) => a.order - b.order);
        sorted.push(...remaining);
        break;
      }

      // 按优先级和order排序
      readyTasks.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // 高优先级在前
        }
        return a.order - b.order;
      });

      const nextTask = readyTasks[0];
      if (!nextTask) {
        break; // 没有可执行的任务，退出循环
      }

      sorted.push(nextTask);
      processed.add(nextTask.id);

      const index = remaining.findIndex(t => t.id === nextTask.id);
      remaining.splice(index, 1);
    }

    return sorted;
  }

  /**
   * 执行任务列表
   */
  private async executeTasks(
    tasks: SubTask[],
    context?: any
  ): Promise<TaskExecutionResult[]> {
    const results: TaskExecutionResult[] = [];
    const parallelGroups: SubTask[][] = [];
    
    // 分组：可并行的任务放在一组
    let currentGroup: SubTask[] = [];
    
    for (const task of tasks) {
      if (task.canParallel && currentGroup.length < this.config.maxParallelTasks) {
        currentGroup.push(task);
      } else {
        if (currentGroup.length > 0) {
          parallelGroups.push(currentGroup);
          currentGroup = [];
        }
        currentGroup.push(task);
      }
    }
    
    if (currentGroup.length > 0) {
      parallelGroups.push(currentGroup);
    }

    // 按组执行任务
    for (const group of parallelGroups) {
      if (group.length === 1) {
        // 单个任务，顺序执行
        const task = group[0];
        if (task) {
          const result = await this.executeTask(task, context);
          results.push(result);
        }
      } else {
        // 多个任务，并行执行
        const groupResults = await Promise.all(
          group.map(task => this.executeTask(task, context))
        );
        results.push(...groupResults);
      }
    }

    return results;
  }

  /**
   * 执行单个任务
   */
  private async executeTask(
    task: SubTask,
    context?: any
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    logger.info('开始执行任务', { taskId: task.id, type: task.type });

    // 检查缓存
    if (this.config.enableTaskCache) {
      const cached = this.getFromCache(task);
      if (cached) {
        logger.info('使用缓存结果', { taskId: task.id });
        return cached;
      }
    }

    let result: TaskExecutionResult;

    try {
      switch (task.type) {
        case TaskType.SIMPLE_CHAT:
          result = await this.executeSimpleTask(task, context);
          break;
        case TaskType.TOOL_CALL:
          result = await this.executeToolTask(task);
          break;
        case TaskType.HYBRID:
          result = await this.executeHybridTask(task, context);
          break;
        default:
          throw new Error(`未知任务类型: ${task.type}`);
      }

      // 缓存结果
      if (this.config.enableTaskCache && result.success) {
        this.cacheResult(task, result);
      }

      logger.info('任务执行完成', {
        taskId: task.id,
        success: result.success,
        duration: result.duration
      });

      return result;
    } catch (error) {
      logger.error('任务执行失败', { taskId: task.id, error });
      
      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 执行简单对话任务
   */
  private async executeSimpleTask(
    task: SubTask,
    context?: any
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now();

    try {
      // 构建简单的上下文信息
      const contextInfo = context ? JSON.stringify(context, null, 2) : '';

      // 使用系统提示词
      const prompt = getSimpleTaskPrompt(task.content, task.type, contextInfo);

      const response = await this.llmProcessor.generateText(prompt);

      return {
        taskId: task.id,
        success: true,
        result: response,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      };
    } catch (error) {
      throw MCPError.executionError(`简单任务执行失败: ${task.id}`, error);
    }
  }

  /**
   * 执行工具调用任务
   */
  private async executeToolTask(
    task: SubTask
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now();

    try {
      // 临时解决方案：直接调用工具，不通过LLM生成代码
      if (task.suggestedTools && task.suggestedTools.length > 0) {
        const toolName = task.suggestedTools[0];
        if (!toolName) {
          throw new Error('工具名称为空');
        }

        const client = this.toolToClientMap.get(toolName);

        if (client) {
          logger.info('直接调用工具', { toolName, taskId: task.id });
          const toolResult = await client.callTool(toolName, {});

          return {
            taskId: task.id,
            success: true,
            result: toolResult,
            duration: Date.now() - startTime,
            toolUsed: toolName,
            timestamp: Date.now()
          };
        } else {
          throw new Error(`工具客户端未找到: ${toolName}`);
        }
      }

      // 如果没有建议工具，抛出错误
      throw new Error('没有可用的工具来执行此任务');
    } catch (error) {
      throw MCPError.executionError(`工具任务执行失败: ${task.id}`, error);
    }
  }

  /**
   * 执行混合任务
   */
  private async executeHybridTask(
    task: SubTask,
    context?: any
  ): Promise<TaskExecutionResult> {
    // 混合任务先尝试工具调用，如果不需要则降级为简单任务
    if (task.needsTool && task.suggestedTools && task.suggestedTools.length > 0) {
      try {
        return await this.executeToolTask(task);
      } catch (error) {
        logger.warn('工具调用失败，降级为简单任务', { taskId: task.id, error });
        return await this.executeSimpleTask(task, context);
      }
    } else {
      return await this.executeSimpleTask(task, context);
    }
  }







  /**
   * 生成最终响应
   */
  private async generateFinalResponse(
    analysisResult: IntentAnalysisResult,
    taskResults: TaskExecutionResult[]
  ): Promise<string> {
    const successResults = taskResults.filter(r => r.success);
    const failedResults = taskResults.filter(r => !r.success);

    // 构建成功结果字符串
    const successResultStrings = successResults.map((r, index) => {
      const task = analysisResult.subTasks.find(t => t.id === r.taskId);
      return `${index + 1}. 任务：${task?.content || r.taskId}
   结果：${typeof r.result === 'string' ? r.result : JSON.stringify(r.result, null, 2)}`;
    });

    // 构建失败结果字符串
    const failedResultStrings = failedResults.map((r, index) => {
      const task = analysisResult.subTasks.find(t => t.id === r.taskId);
      return `${index + 1}. 任务：${task?.content || r.taskId}
   错误：${r.error}`;
    });

    // 使用系统提示词
    const prompt = getFinalResponsePrompt(
      analysisResult.overallType,
      analysisResult.confidence,
      successResultStrings,
      failedResultStrings
    );

    return await this.llmProcessor.generateText(prompt);
  }

  /**
   * 缓存相关方法
   */
  private getFromCache(task: SubTask): TaskExecutionResult | null {
    const key = this.getCacheKey(task);
    const cached = this.taskCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.config.cacheExpiration) {
      return cached;
    }
    
    if (cached) {
      this.taskCache.delete(key);
    }
    
    return null;
  }

  private cacheResult(task: SubTask, result: TaskExecutionResult): void {
    const key = this.getCacheKey(task);
    this.taskCache.set(key, result);
  }

  private getCacheKey(task: SubTask): string {
    return `${task.type}_${task.content}_${JSON.stringify(task.suggestedTools)}`;
  }

  /**
   * 清理过期缓存
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, result] of this.taskCache) {
      if (now - result.timestamp > this.config.cacheExpiration) {
        this.taskCache.delete(key);
      }
    }
  }

  /**
   * 获取配置
   */
  getConfig(): TaskExecutorConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<TaskExecutorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('更新任务执行器配置', newConfig);
  }

  addToolClient(toolName: string, client: MCPClient): void {
    if (!this.toolToClientMap.has(toolName)) {
      this.toolToClientMap.set(toolName, client);
      logger.info(`Tool client added for '${toolName}'.`);
    }
  }
}
