/**
 * 简化的 LLM NLP 处理器
 */

import { 
  INLProcessor, 
  AnalysisResult, 
  ToolConfig, 
  ToolParameters,
  LLMConfig
} from '../types/index.js';
// 移除扩展类型的引用
import { LLMConfigManager } from './config.js';
import { LLMService } from './service.js';
import { createMCPLogger } from '../utils/logger.js';
import { LLMServiceError, LLMParsingError } from './errors.js';
import { getConfig } from '../config/index.js';

const logger = createMCPLogger('LLMNLPProcessor');

export interface LLMNLPProcessorOptions {
  enableContextualAnalysis?: boolean;
  enableSmartCompletion?: boolean;
  enableLearning?: boolean;
  enableFallback?: boolean;
  maxContextMessages?: number;
  cacheResults?: boolean;
}

export class LLMNLPProcessor implements INLProcessor {
  private configManager: LLMConfigManager;
  private llmService: LLMService;
  private options: Required<LLMNLPProcessorOptions>;
  private confidenceThreshold: number = 0.7;
  private processingStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageProcessingTime: 0
  };

  constructor(configManager: LLMConfigManager, options: LLMNLPProcessorOptions = {}) {
    this.configManager = configManager;
    this.llmService = new LLMService(configManager.getConfig());
    
    this.options = {
      enableContextualAnalysis: options.enableContextualAnalysis ?? true,
      enableSmartCompletion: options.enableSmartCompletion ?? true,
      enableLearning: options.enableLearning ?? false,
      enableFallback: options.enableFallback ?? true,
      maxContextMessages: options.maxContextMessages ?? 10,
      cacheResults: options.cacheResults ?? true
    };
  }

  /**
   * 分析消息内容（实现INLProcessor接口）
   */
  async analyzeMessage(message: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    this.processingStats.totalRequests++;
    
    try {
      logger.debug('Analyzing message with LLM', {
        messageLength: message.length,
        enableContextual: this.options.enableContextualAnalysis
      });

      // 获取可用工具
      const availableTools = this.getAvailableTools();
      
      // 构建分析提示
      const prompt = this.buildAnalysisPrompt(message, availableTools);
      
      // 调用LLM进行分析
      const llmResponse = await this.llmService.generateCompletion(prompt);
      
      // 解析LLM响应
      const intentResult = this.parseIntentAnalysisResponse(llmResponse);
      
      // 如果识别到工具，提取参数
      let parameters: ToolParameters = {};
      if (intentResult.suggestedTool) {
        const toolConfig = availableTools.find(tool => tool.name === intentResult.suggestedTool);
        if (toolConfig) {
          parameters = await this.extractParameters(message, toolConfig);
        }
      }

      // 构建结果
      const result: AnalysisResult = {
        intent: intentResult.suggestedTool || 'general_chat',
        confidence: intentResult.confidence,
        suggestedTool: intentResult.suggestedTool || undefined,
        parameters,
        entities: []
      };

      // 更新统计
      const processingTime = Date.now() - startTime;
      this.updateStats(true, processingTime);

      logger.debug('Message analysis completed', {
        intent: result.intent,
        confidence: result.confidence,
        processingTime
      });

      return result;

    } catch (error) {
      this.updateStats(false, Date.now() - startTime);
      logger.error('Message analysis failed', error);
      
      // 返回默认结果
      return {
        intent: 'general_chat',
        confidence: 0,
        parameters: {}
        // entities: []  // 暂时注释，类型不匹配
      };
    }
  }

  /**
   * 带上下文的消息分析
   */
  async analyzeWithContext(
    message: string, 
    context?: any
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      // 基础分析
      const basicResult = await this.analyzeMessage(message);
      
      // 构建增强结果
      const enhancedResult: AnalysisResult = {
        intent: basicResult.intent,
        confidence: basicResult.confidence,
        parameters: basicResult.parameters || {},
        suggestedTool: basicResult.suggestedTool || undefined,
        // reasoning: `基于LLM分析，识别意图为: ${basicResult.intent}`,
        entities: [],  // 添加空的entities数组
        // llmUsed: true
      };

      return enhancedResult;

    } catch (error) {
      logger.error('Contextual analysis failed', error);
      
      // 返回默认结果
      return {
        intent: 'general_chat',
        confidence: 0,
        parameters: {},
        // reasoning: '分析失败，使用默认结果',
        entities: [],  // 添加空的entities数组
        // llmUsed: false,
        // fallbackReason: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 提取工具参数
   */
  async extractParameters(message: string, toolConfig: ToolConfig): Promise<ToolParameters> {
    try {
      const prompt = this.buildParameterExtractionPrompt(message, toolConfig);
      const llmResponse = await this.llmService.generateCompletion(prompt);
      const extractionResult = this.parseParameterExtractionResponse(llmResponse);
      
      return extractionResult.parameters;
      
    } catch (error) {
      logger.warn('Parameter extraction failed, using defaults', error);
      
      // 返回默认参数
      const defaultParams: ToolParameters = {};
      for (const [paramName, paramConfig] of Object.entries(toolConfig.parameters)) {
        if ((paramConfig as any).default !== undefined) {
          defaultParams[paramName] = (paramConfig as any).default;
        }
      }
      
      return defaultParams;
    }
  }

  /**
   * 学习用户交互
   */
  learnFromInteraction(
    toolName: string,
    parameters: ToolParameters,
    success: boolean,
    userId: string
  ): void {
    if (!this.options.enableLearning) {
      return;
    }

    logger.debug('Learning from interaction', {
      toolName,
      success,
      userId,
      parametersCount: Object.keys(parameters).length
    });

    // 简化实现 - 在实际项目中可以实现更复杂的学习逻辑
    // 例如：调整置信度阈值、优化提示词等
  }

  /**
   * [ReAct] 直接生成文本，用于思考步骤
   */
  async generateText(prompt: string): Promise<string> {
    const startTime = Date.now();
    this.processingStats.totalRequests++;

    try {
      const llmResponse = await this.llmService.generateCompletion(prompt);
      this.updateStats(true, Date.now() - startTime);
      return llmResponse;
    } catch (error) {
      this.updateStats(false, Date.now() - startTime);
      logger.error('Text generation failed in LLMNLPProcessor', error);
      throw new LLMServiceError('Failed to generate text');
    }
  }

  /**
   * 设置置信度阈值
   */
  setConfidenceThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('置信度阈值必须在0-1之间');
    }
    this.confidenceThreshold = threshold;
    logger.info('Confidence threshold updated', { threshold });
  }

  /**
   * 获取置信度阈值
   */
  getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }

  /**
   * 获取处理器统计信息
   */
  getProcessorStats(): any {
    return {
      ...this.processingStats,
      llmMetrics: this.llmService.getMetrics(),
      isHealthy: this.llmService.isHealthy()
    };
  }

  /**
   * 获取可用工具
   */
  private getAvailableTools(): ToolConfig[] {
    const config = getConfig();
    return Object.values(config.tools).filter((tool: any) => tool.enabled) as any[];
  }

  /**
   * 构建分析提示
   */
  private buildAnalysisPrompt(message: string, tools: ToolConfig[]): string {
    const toolDescriptions = tools.map(tool => 
      `- ${tool.name}: ${tool.description}`
    ).join('\n');

    return `你是一个智能工具调用分析器。分析用户消息，判断是否需要调用某个工具。

可用工具列表:
${toolDescriptions}

你的任务是根据用户消息，判断意图并以JSON格式返回。
如果用户的意图与某个工具匹配，请指明该工具。
如果用户的意图不匹配任何工具，则判断为通用聊天。

下面是一些例子:

---
用户消息: "查一下今天北京的天气"
(假设有一个名为 'weather' 的工具，描述为 "查询天气信息")
你的输出:
\`\`\`json
{
  "toolName": "weather",
  "confidence": 0.9,
  "reasoning": "用户想要查询天气，匹配 'weather' 工具。"
}
\`\`\`
---
用户消息: "jojo"
你的输出:
\`\`\`json
{
  "toolName": "jojo",
  "confidence": 1.0,
  "reasoning": "用户直接通过名称引用'jojo'工具。"
}
\`\`\`
---
用户消息: "你好"
你的输出:
\`\`\`json
{
  "toolName": null,
  "confidence": 0.95,
  "reasoning": "这是一个通用问候语，没有调用工具的意图。"
}
\`\`\`
---

现在，请分析以下用户消息：

用户消息: "${message}"

请严格按照以上JSON格式返回你的分析结果，不要包含任何其他多余的文字。
你的输出:
`;
  }

  /**
   * 构建参数提取提示
   */
  private buildParameterExtractionPrompt(message: string, toolConfig: ToolConfig): string {
    const paramDescriptions = Object.entries(toolConfig.parameters)
      .map(([name, config]) => `- ${name}: ${(config as any).description || '无描述'} (${(config as any).required ? '必需' : '可选'})`)
      .join('\n');

    return `从用户消息中提取工具参数。

工具：${toolConfig.name}
参数：
${paramDescriptions}

用户消息：${message}

请提取参数，返回JSON格式：
{
  "parameters": {"参数名": "参数值"},
  "missingRequired": ["缺失的必需参数"],
  "confidence": 0.0-1.0
}`;
  }

  /**
   * 解析意图分析响应
   */
  private parseIntentAnalysisResponse(response: string): AnalysisResult {
    try {
      // 尝试从响应中提取JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('未找到JSON响应');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        intent: parsed.intent || 'general_chat',
        suggestedTool: parsed.toolName || null,
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        entities: parsed.entities || []
      };
      
    } catch (error) {
      logger.warn('Failed to parse intent analysis response', { response, error });
      throw new LLMParsingError('意图分析响应解析失败');
    }
  }

  /**
   * 解析参数提取响应
   */
  private parseParameterExtractionResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('未找到JSON响应');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        parameters: parsed.parameters || {},
        missingRequired: parsed.missingRequired || [],
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        extractedCount: Object.keys(parsed.parameters || {}).length,
        totalRequired: parsed.totalRequired || 0
      };
      
    } catch (error) {
      logger.warn('Failed to parse parameter extraction response', { response, error });
      throw new LLMParsingError('参数提取响应解析失败');
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(success: boolean, processingTime: number): void {
    if (success) {
      this.processingStats.successfulRequests++;
    } else {
      this.processingStats.failedRequests++;
    }

    // 更新平均处理时间
    const totalSuccessful = this.processingStats.successfulRequests;
    if (totalSuccessful > 0) {
      this.processingStats.averageProcessingTime = 
        (this.processingStats.averageProcessingTime * (totalSuccessful - 1) + processingTime) / totalSuccessful;
    }
  }
}
