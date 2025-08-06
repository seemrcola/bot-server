import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { BaseMessage } from "@langchain/core/messages";
import { createLogger } from '../utils/logger.js';
import { MCPServer } from './server/index.js';
import { MCPClient } from "./client/MCPClient.js";
import { ClientManager, ExternalServerConfig } from './client/manager.js'; // 更新导入路径
import getPort from 'get-port';

const logger = createLogger('Agent');

/**
 * Agent 是整个系统的核心，负责：
 * 1. 接收一个预先配置好的大语言模型 (LLM)。
 * 2. 管理一个内部的 MCP 服务器来托管“内置”工具。
 * 3. 管理一个 ClientManager 来连接和使用外部工具服务。
 * 4. 结合 LLM、系统提示和所有可用工具（内部+外部）来处理用户请求。
 */
export class Agent {
  private llm: BaseLanguageModel;
  private internalTools: any[];
  private systemPrompt: string;
  private internalServer: MCPServer;
  private internalClient: MCPClient;
  private externalClientManager: ClientManager;
  private allTools: any[] = []; // 缓存所有可用工具

  /**
   * 创建一个新的 Agent 实例。
   * @param llm 一个已经初始化好的 BaseLanguageModel 实例。
   * @param internalTools 一个“内置”工具的数组。
   * @param externalServers 一个外部 MCP 服务器的配置数组。
   * @param systemPrompt 一个将用于指导 LLM 回复的系统提示字符串。
   */
  constructor(
    llm: BaseLanguageModel,
    internalTools: any[] = [],
    externalServers: ExternalServerConfig[] = [],
    systemPrompt: string
  ) {
    if (!llm) throw new Error("Agent 需要一个有效的 LLM 实例。");
    
    this.llm = llm;
    this.internalTools = internalTools;
    this.systemPrompt = systemPrompt || "你是一个乐于助人的 AI 助手。";
    
    this.internalServer = new MCPServer();
    this.internalClient = new MCPClient();
    this.externalClientManager = new ClientManager();

    logger.info('Agent 已创建。正在初始化内部和外部服务...');
    this.initialize(externalServers);
  }

  /**
   * 异步初始化 Agent 的所有内部和外部服务。
   */
  private async initialize(externalServers: ExternalServerConfig[]) {
    try {
      // 1. 初始化并启动内部服务器
      this.internalServer.registerTools(this.internalTools);
      const port = await getPort();
      const host = 'localhost';
      await this.internalServer.listen(port, host);
      
      // 2. 将内部客户端连接到内部服务器
      const serverUrl = `http://${host}:${port}/mcp`;
      await this.internalClient.connect(serverUrl);

      // 3. 使用管理器连接到所有外部服务器
      await this.externalClientManager.connect(externalServers);
      
      // 4. 汇总所有工具
      const internalToolsResult = await this.internalClient.listTools();
      // 防御性编程：确保无论 listTools 返回单个对象还是数组，我们都处理为数组
      const internalToolsList = Array.isArray(internalToolsResult) 
        ? internalToolsResult 
        : (internalToolsResult ? [internalToolsResult] : []);

      const externalToolsList = await this.externalClientManager.getAllTools();
      this.allTools = [...internalToolsList, ...externalToolsList];
      
      logger.info('Agent 初始化完成。');
      logger.info(`共发现 ${this.allTools.length} 个工具 (${internalToolsList.length} 个内部, ${externalToolsList.length} 个外部)。`);

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
    // 在决定调用工具时，需要判断是内部工具还是外部工具，然后选择正确的客户端
    // (this.internalClient 或 this.externalClientManager) 来执行。
    yield "Agent 正在思考中... (功能待实现)";
  }
}
