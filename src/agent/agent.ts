import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { BaseMessage } from "@langchain/core/messages";
import { createLogger } from '../utils/logger.js';
import { ClientManager, ExternalServerConfig } from './mcp/client/manager.js';

const logger = createLogger('Agent');

/**
 * Agent 是整个系统的核心，负责：
 * 1. 接收一个预先配置好的大语言模型 (LLM)。
 * 2. 管理一个 ClientManager 来连接和使用外部工具服务。
 * 3. 结合 LLM、系统提示和所有可用工具来处理用户请求。
 */
export class Agent {
  private llm: BaseLanguageModel;
  private systemPrompt: string;
  private externalClientManager: ClientManager;
  private allTools: any[] = []; // 缓存所有可用工具

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
    this.systemPrompt = systemPrompt || "";
    
    this.externalClientManager = new ClientManager();

    logger.info('Agent 已创建。正在初始化外部服务...');
    this.initialize(externalServers);
  }

  /**
   * 异步初始化 Agent 的所有外部服务。
   */
  private async initialize(externalServers: ExternalServerConfig[]) {
    try {
      // 1. 使用管理器连接到所有外部服务器
      await this.externalClientManager.connect(externalServers);
      
      // 2. 汇总所有工具
      this.allTools = await this.externalClientManager.getAllTools();
      
      logger.info('Agent 初始化完成。');
      logger.info(`共发现 ${this.allTools.length} 个外部工具。`);

    } catch (error) {
      logger.error('Agent 初始化失败', error);
      throw error;
    }
  }

  /**
   * 处理用户消息流的核心逻辑。
   */
  public async *processMessageStream(messages: BaseMessage[], sessionId?: string): AsyncIterable<string> {
    logger.info('Agent 收到消息，开始处理...');
    
    yield `Agent 发现了 ${this.allTools.length} 个可用工具。\n`;

    // TODO: 实现 ReAct 逻辑，结合 this.llm, this.systemPrompt, 和所有工具。
    // 现在所有工具都来自 externalClientManager，逻辑会更简单。
    yield "Agent 正在思考中... (功能待实现)";
  }
}
