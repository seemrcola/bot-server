import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { createLogger } from '../utils/logger.js';
import { ClientManager, ExternalServerConfig } from './mcp/client/manager.js';
import { Runnable } from "@langchain/core/runnables";
import { createToolCallingExecutor } from "./llm/index.js";

const logger = createLogger('Agent');

/**
 * Agent 是整个系统的核心，负责：
 * 1. 接收一个预先配置好的大语言模型 (LLM)。
 * 2. 管理一个 ClientManager 来连接和使用外部工具服务。
 * 3. 结合 LLM、系统提示和工具来处理用户请求。
 */
export class Agent {
  private llm: BaseLanguageModel;
  private systemPrompt: string;
  private externalClientManager: ClientManager;
  private allTools: any[] = [];

  constructor(
    llm: BaseLanguageModel,
    externalServers: ExternalServerConfig[] = [],
    systemPrompt: string
  ) {
    if (!llm) throw new Error("Agent 需要一个有效的 LLM 实例。");
    
    this.llm = llm;
    this.systemPrompt = systemPrompt || '';
    this.externalClientManager = new ClientManager();

    logger.info('Agent 已创建。正在初始化外部服务...');
    this.initialize(externalServers);
  }

  private async initialize(externalServers: ExternalServerConfig[]) {
    try {
      // 为每一个外部服务器创建一个客户端
      await this.externalClientManager.connect(externalServers);
      // 获取这些服务包含的所有工具
      this.allTools = await this.externalClientManager.getAllTools();
      logger.info('Agent 初始化完成。');
      logger.info(`发现了 ${this.allTools.length} 个外部工具。`);
    } catch (error) {
      logger.error('Agent 初始化失败', error);
      throw error;
    }
  }

  /**
   * 【第一步】分析用户最新消息的意图，判断是否需要调用工具。
   * @param lastMessage 用户的最新一条消息。
   * @returns 如果需要调用工具，则返回第一个工具调用对象；否则返回 null。
   */
  private async _analyzeUserIntent(lastMessage: BaseMessage): Promise<any | null> {
    logger.info("开始执行意图分析...");
    
    // 1. 按需创建绑定了工具的执行器
    let agentExecutor: Runnable = this.llm;
    if (this.allTools.length > 0) {
      const formattedTools = this.allTools.map(tool => ({
        name: tool.name,
        description: tool.description, // 直接从 tool 对象获取
        schema: tool.inputSchema,      // 直接从 tool 对象获取
      }));
      agentExecutor = createToolCallingExecutor(this.llm, formattedTools);
    } else {
      logger.info("无可用工具，跳过意图分析。");
      return null;
    }
    
    // 2. 准备意图分析所需的最少消息
    const intentAnalysisMessages: BaseMessage[] = [
      new HumanMessage(this.systemPrompt),
      lastMessage
    ];

    // 3. 调用LLM并获取响应
    const intentResponse = await agentExecutor.invoke(intentAnalysisMessages);

    // 4. 检查并返回结果
    if (intentResponse.tool_calls && intentResponse.tool_calls.length > 0) {
      const toolCall = intentResponse.tool_calls[0];
      logger.info(`意图分析成功: 模型建议调用工具 -> ${toolCall.name}`);
      return toolCall;
    }
    
    logger.info("意图分析完成: 无需调用工具。");
    return null;
  }

  /**
   * 处理用户消息流的核心逻辑。
   */
  public async *processMessageStream(messages: BaseMessage[], sessionId?: string): AsyncIterable<string> {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      yield "未收到任何消息。";
      return;
    }

    // 调用新创建的意图分析函数
    const toolCall = await this._analyzeUserIntent(lastMessage);

    if (toolCall) {
      // 在下一步中，我们将在这里实现工具调用逻辑
      yield `[临时响应] 模型意图是调用工具: ${toolCall.name}，参数: ${JSON.stringify(toolCall.args)}`;
    } else {
      // 在下一步中，我们将在这里实现常规LLM调用逻辑
      yield "[临时响应] 模型意图是进行常规对话。";
    }
  }
}
