import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { createLogger } from '../utils/logger.js';
import { ClientManager, ExternalServerConfig } from './mcp/client/manager.js';

const logger = createLogger('Agent');

/**
 * Agent 是整个系统的核心，负责：
 * 1. 接收一个预先配置好的大语言模型 (LLM)。
 * 2. 管理一个 ClientManager 来连接和使用外部工具服务。
 * 3. 结合 LLM、系统提示来处理用户请求。
 */
export class Agent {
  private llm: BaseLanguageModel;
  private systemPrompt: string;
  private externalClientManager: ClientManager;

  /**
   * 创建一个新的 Agent 实例。
   * @param llm 一个已经初始化好的 BaseLanguageModel 实例。
   * @param externalServers 一个外部 MCP 服务器的配置数组。
   * @param systemPrompt 一个将用于指导 LLM 回复的系统提示字符串。
   */
  constructor(
    llm: BaseLanguageModel,
    externalServers: ExternalServerConfig[] = [],
    systemPrompt: string
  ) {
    if (!llm) throw new Error("Agent 需要一个有效的 LLM 实例。");
    
    this.llm = llm;
    this.systemPrompt = systemPrompt || "你是一个乐于助人的 AI 助手。";
    
    this.externalClientManager = new ClientManager();

    logger.info('Agent 已创建。正在初始化外部服务...');
    this.initialize(externalServers);
  }

  /**
   * 异步初始化 Agent 的所有外部服务。
   */
  private async initialize(externalServers: ExternalServerConfig[]) {
    try {
      // 在这个简化版本中，我们仍然可以连接到外部服务器，
      // 尽管我们暂时不会使用它们的工具。
      await this.externalClientManager.connect(externalServers);
      const tools = await this.externalClientManager.getAllTools();
      logger.info('Agent 初始化完成。');
      logger.info(`发现了 ${tools.length} 个外部工具 (暂不使用)。`);

    } catch (error) {
      logger.error('Agent 初始化失败', error);
      throw error;
    }
  }

  /**
   * 处理用户消息流的核心逻辑 (基础LLM调用)。
   */
  public async *processMessageStream(messages: BaseMessage[], sessionId?: string): AsyncIterable<string> {
    logger.info('Agent 收到消息，开始基础 LLM 调用...');
    
    const history: BaseMessage[] = [
      new HumanMessage(this.systemPrompt), 
      ...messages
    ];
    
    const stream = await this.llm.stream(history);

    for await (const chunk of stream) {
      // chunk.content 的类型可能是 string | string[] | any[]
      // 我们需要处理这种情况
      if (typeof chunk.content === 'string') {
        yield chunk.content;
      } else if (Array.isArray(chunk.content)) {
        // 如果是数组，我们假设它包含可以转换为字符串的内容
        yield chunk.content.join("");
      }
    }
    
    logger.info("Agent 基础 LLM 调用完成。");
  }
}
