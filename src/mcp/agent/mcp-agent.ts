/**
 * MCP代理核心实现 - ReAct模式
 */

import {
  IMCPAgent,
  MCPResponse,
  ChatContext,
  MCPAgentConfig,

} from '../types/index.js';
import { MCPError } from '../utils/errors.js';
import { createMCPLogger } from '../utils/logger.js';
import { LLMNLPProcessor } from '../llm/index.js';
import { MCPClient } from '../client/mcp-client.js';
import { ServerManager } from '../servers/manager.js';
import { IntentAnalyzer } from './intent-analyzer.js';
import { TaskExecutor } from './task-executor.js';
import { TaskType } from '../types/intent.types.js';
import { IMCPServer } from '../types/index.js';

const logger = createMCPLogger('Agent');

type ServerRegistration = {
  name: string;
  server: IMCPServer;
};

export class MCPAgent implements IMCPAgent {
  private initialized = false;
  private agentConfig: MCPAgentConfig;
  private llmNLProcessor: LLMNLPProcessor | undefined;
  private serverManager: ServerManager;
  private clients: Map<string, MCPClient> = new Map();
  private toolToClientMap: Map<string, MCPClient> = new Map();
  private intentAnalyzer: IntentAnalyzer | undefined;
  private taskExecutor: TaskExecutor | undefined;
  private serverRegistrations: ServerRegistration[];

  constructor(config: MCPAgentConfig, serverRegistrations: ServerRegistration[] = []) {
    this.agentConfig = config;
    this.serverManager = ServerManager.getInstance();
    this.serverRegistrations = serverRegistrations;
  }
  private async cleanup(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.disconnect();
    }
    this.clients.clear();
    this.toolToClientMap.clear();
    await this.serverManager.stopAllServers();

    // 清理新组件
    this.llmNLProcessor = undefined;
    this.intentAnalyzer = undefined;
    this.taskExecutor = undefined;
  }

  getConfig(): MCPAgentConfig {
    return this.agentConfig;
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing MCP Agent...');
      if (!this.agentConfig.enabled) {
        logger.info('MCP Agent is disabled, skipping initialization');
        return;
      }
      
      logger.info('Initializing LLM NLP Processor...');
      const llmConfig = this.agentConfig.llm;
      if (llmConfig && llmConfig.apiKey) {
        this.llmNLProcessor = new LLMNLPProcessor({
          enableContextualAnalysis: true,
          enableSmartCompletion: true,
        });
        this.llmNLProcessor?.setConfidenceThreshold(
          this.agentConfig.nlp?.confidenceThreshold || 0.7
        );
      } else {
        throw new Error(
          'LLM configuration with apiKey is required for ReAct Agent'
        );
      }

      await this.serverManager.registerAndStartServers(this.serverRegistrations);
      await this.initializeClients();

      // 初始化意图分析器和任务执行器
      await this.initializeIntentComponents();

      this.initialized = true;
      logger.info('MCP Agent initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MCP Agent', error);
      throw MCPError.initializationError('MCP代理初始化失败', error);
    }
  }

  /**
   * [流式处理] 渐进式处理用户消息，实时输出进度
   */
  async* processMessageStream(
    message: string,
    context: ChatContext
  ): AsyncIterable<string> {
    if (
      !this.initialized ||
      !this.agentConfig.enabled ||
      !this.llmNLProcessor ||
      !this.intentAnalyzer ||
      !this.taskExecutor
    ) {
      yield message;
      return;
    }

    try {
      // 阶段1：开始处理
      yield "🤔 正在分析您的请求...\n\n";
      await new Promise(resolve => setTimeout(resolve, 500));

      // 阶段2：意图分析
      yield "🔍 正在进行意图分析...\n";

      const analysisResult = await this.intentAnalyzer.analyzeIntent(message, context);

      if (analysisResult && analysisResult.subTasks.length > 0) {
        const toolTasks = analysisResult.subTasks.filter(task => task.needsTool);

        if (toolTasks.length > 0) {
          const requiredTools = Array.from(new Set(
            toolTasks.flatMap(task => task.suggestedTools || [])
          ));

          if (requiredTools.length > 0) {
            const toolNames = requiredTools.join(', ');
            yield `✅ 检测到需要调用: ${toolNames}\n\n`;
          }
          await new Promise(resolve => setTimeout(resolve, 300));

          // 阶段3：工具调用
          yield "🛠️ 正在调用工具...\n";

          const executionResult = await this.taskExecutor.executeIntentAnalysis(analysisResult, context);

          if (executionResult?.success) {
            yield "✅ 工具调用完成！\n\n";
            await new Promise(resolve => setTimeout(resolve, 200));

            // 阶段4：生成最终回复
            yield "📝 正在生成回复...\n\n";
            await new Promise(resolve => setTimeout(resolve, 300));

            // 流式输出最终结果
            if (executionResult.finalResponse) {
              yield* this.createTextStream(executionResult.finalResponse);
            }
          } else {
            yield "❌ 工具调用失败，使用常规处理...\n\n";
            const fallbackResponse = await this.handleSimpleChat(message, context);
            yield* this.createTextStream(fallbackResponse);
          }
        } else {
          // 简单聊天任务
          const response = await this.handleSimpleChat(message, context);
          yield* this.createTextStream(response);
        }
      }

    } catch (error) {
      logger.error('流式处理过程中出现错误', error);
      yield "❌ 处理过程中出现错误，正在使用备用方案...\n\n";

      try {
        const mcpResponse = await this.processMessage(message, context);
        if (mcpResponse.enhancedMessage) {
          yield* this.createTextStream(mcpResponse.enhancedMessage);
        }
      } catch (fallbackError) {
        yield "抱歉，处理您的请求时遇到了问题，请稍后重试。";
      }
    }
  }

  /**
   * 创建文本流式输出
   */
  private async* createTextStream(text: string, chunkSize: number = 3, delay: number = 20): AsyncIterable<string> {
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize);
      yield chunk;

      if (i + chunkSize < text.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * [混合处理] 核心流程: 通过意图分析和任务分解处理用户消息
   */
  async processMessage(
    message: string,
    context: ChatContext
  ): Promise<MCPResponse> {
    if (
      !this.initialized ||
      !this.agentConfig.enabled ||
      !this.llmNLProcessor ||
      !this.intentAnalyzer ||
      !this.taskExecutor
    ) {
      return {
        needsToolCall: false,
        enhancedMessage: message,
      };
    }

    try {
      logger.info('开始混合处理用户消息', { message });

      // 1. 意图分析 - 将消息分解为子任务
      const analysisResult = await this.intentAnalyzer.analyzeIntent(
        message,
        context
      );

      logger.info('意图分析完成', {
        taskCount: analysisResult.subTasks.length,
        overallType: analysisResult.overallType,
        hasToolTasks: analysisResult.hasToolTasks,
        hasSimpleTasks: analysisResult.hasSimpleTasks
      });

      // 2. 根据分析结果选择处理策略
      if (analysisResult.overallType === TaskType.SIMPLE_CHAT) {
        // 纯对话任务，直接使用LLM处理
        const response = await this.handleSimpleChat(message, context);
        return {
          needsToolCall: false,
          enhancedMessage: response,
        };
      } else {
        // 包含工具调用或混合任务，使用任务执行器
        const executionResult = await this.taskExecutor.executeIntentAnalysis(
          analysisResult,
          context
        );

        return {
          needsToolCall: false,
          enhancedMessage: executionResult.finalResponse,
        };
      }
    } catch (error) {
      logger.error('混合处理过程中出现错误', error);
      // Since the main logic failed, we re-throw the error to be handled by the caller.
      // This avoids complex fallback logic within the agent itself.
      throw MCPError.executionError('处理消息时出现错误，请稍后重试', error);
    }
  }

  /**
   * 初始化意图分析器和任务执行器
   */
  private async initializeIntentComponents(): Promise<void> {
    if (!this.llmNLProcessor) {
      throw new Error('LLM NLP Processor must be initialized first');
    }

    try {
      // 获取可用工具列表及其描述
      const availableToolsWithDescriptions: Array<{name: string, description: string}> = [];
      
      for (const [toolName, client] of this.toolToClientMap) {
        try {
          const toolInfo = client.getToolInfo(toolName);
          availableToolsWithDescriptions.push({
            name: toolName,
            description: toolInfo?.description || `工具: ${toolName}`
          });
        } catch (error) {
          logger.warn(`获取工具 ${toolName} 的描述失败`, error);
          availableToolsWithDescriptions.push({
            name: toolName,
            description: `工具: ${toolName}`
          });
        }
      }

      // 初始化意图分析器
      this.intentAnalyzer = new IntentAnalyzer(
        this.llmNLProcessor,
        availableToolsWithDescriptions.map(tool => tool.name), // 保持兼容性
        {
          maxSubTasks: 8,
          minConfidence: 0.6,
          enableParallelExecution: true,
          taskTimeout: 30000,
          enableContextAware: true,
          toolCallTimeout: 15000
        }
      );

      // 更新工具描述信息
      this.intentAnalyzer.updateAvailableToolsWithDescriptions(availableToolsWithDescriptions);

      // 初始化任务执行器
      this.taskExecutor = new TaskExecutor(
        this.llmNLProcessor,
        this.toolToClientMap,
        {
          maxParallelTasks: 3,
          maxRetries: 2,
          retryDelay: 1000,
          enableTaskCache: true,
          cacheExpiration: 300000
        }
      );

      logger.info('意图分析器和任务执行器初始化完成', {
        availableToolsCount: availableToolsWithDescriptions.length,
        toolsWithDescriptions: availableToolsWithDescriptions.map(t => `${t.name}: ${t.description}`)
      });
    } catch (error) {
      logger.error('初始化意图组件失败', error);
      throw error;
    }
  }

  /**
   * 处理简单聊天任务
   */
  private async handleSimpleChat(message: string, context: ChatContext): Promise<string> {
    const prompt = `你是一个专业友好的AI助手，请根据用户的消息提供有用的回复。

用户消息：${message}

${context.history && context.history.length > 0 ?
  `对话历史：\n${context.history.map((h: any) => `${h.role}: ${h.content}`).join('\n')}` :
  ''
}

回复要求：
1. 不要直接重复用户的消息内容
2. 提供实际有用的信息或回复
3. 如果用户要求代码，请提供完整可用的代码示例
4. 如果用户询问概念，请提供清晰的解释
5. 保持自然友好的对话语调
6. 根据上下文提供相关的回复

请提供回复：`;

    return await this.llmNLProcessor!.generateText(prompt);
  }









  private getToolInfo(toolName: string): any | undefined {
    const client = this.getClientForTool(toolName);
    return client?.getToolInfo(toolName);
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down MCP Agent...');

      await this.cleanup();
      this.initialized = false;
      logger.info('MCP Agent shutdown completed');
    } catch (error) {
      logger.error('Error during MCP Agent shutdown', error);
      throw MCPError.executionError('MCP代理关闭失败', error);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private async initializeClients(): Promise<void> {
    const servers = this.serverManager.getAllServers();
    logger.info(`Initializing clients for ${servers.length} servers...`);

    for (const server of servers) {
      const serverOptions = server.getOptions();
      const serverUrl = `ws://${serverOptions.host}:${serverOptions.port}`;

      const client = new MCPClient({
        serverUrl: serverUrl,
        reconnectDelay: this.agentConfig.client.reconnectDelay,
        maxReconnectAttempts: this.agentConfig.nlp?.maxRetries || 3,
      });

      try {
        await client.connect();
        const serverName = `server-on-port-${serverOptions.port}`;
        this.clients.set(serverName, client);
        logger.info(`Client connected to server at ${serverUrl}`);

        const tools = await client.listTools();
        for (const tool of tools) {
          this.toolToClientMap.set(tool.name, client);
          logger.info(
            `Mapped tool '${tool.name}' to client for ${serverUrl}`
          );
        }

        // 更新意图分析器的可用工具列表
        if (this.intentAnalyzer) {
          const availableToolsWithDescriptions: Array<{name: string, description: string}> = [];
          
          for (const [toolName, client] of this.toolToClientMap) {
            try {
              const toolInfo = client.getToolInfo(toolName);
              availableToolsWithDescriptions.push({
                name: toolName,
                description: toolInfo?.description || `工具: ${toolName}`
              });
            } catch (error) {
              availableToolsWithDescriptions.push({
                name: toolName,
                description: `工具: ${toolName}`
              });
            }
          }
          
          this.intentAnalyzer.updateAvailableToolsWithDescriptions(availableToolsWithDescriptions);
        }
      } catch (error) {
        logger.error(
          `Failed to connect client to server at ${serverUrl}`,
          error
        );
      }
    }
  }

  getStatus(): {
    initialized: boolean;
    enabled: boolean;
    clientConnected: boolean;
    serverRunning: boolean;
    registeredTools: string[];
    useLLMProcessor: boolean;
    llmHealthy?: boolean;
  } {
    const allTools = Array.from(this.toolToClientMap.keys());
    const clientConnections = Array.from(this.clients.values()).map((c) =>
      c.isConnected()
    );

    return {
      initialized: this.initialized,
      enabled: this.agentConfig.enabled,
      clientConnected:
        clientConnections.length > 0 && clientConnections.every(Boolean),
      serverRunning: this.serverManager.getAllServers().length > 0,
      registeredTools: allTools,
      useLLMProcessor: true, // Always true in ReAct mode
      llmHealthy: this.llmNLProcessor ? true : false,
    };
  }

  /**
   * 获取所有已注册工具的关键词
   */
  getAllToolKeywords(): string[] {
    const allKeywords: string[] = [];
    
    for (const [toolName, client] of this.toolToClientMap) {
      try {
        const toolInfo = client.getToolInfo(toolName);
        if (toolInfo && toolInfo.keywords) {
          allKeywords.push(...toolInfo.keywords);
        }
      } catch (error) {
        logger.warn(`Failed to get keywords for tool: ${toolName}`, error);
      }
    }
    
    return Array.from(new Set(allKeywords)); // 去重
  }



  private getClientForTool(toolName: string): MCPClient | undefined {
    return this.toolToClientMap.get(toolName);
  }

  destroy(): void {
    for (const client of this.clients.values()) {
      client.disconnect().catch((error: any) => {
        logger.error('销毁时断开客户端连接失败', error);
      });
    }
    this.clients.clear();
    this.toolToClientMap.clear();

    this.serverManager.stopAllServers().catch((error: any) => {
      logger.error('销毁时停止服务管理器失败', error);
    });

    this.llmNLProcessor = undefined;
    this.intentAnalyzer = undefined;
    this.taskExecutor = undefined;

    this.initialized = false;
    logger.info('MCP Agent已销毁');
  }
}
