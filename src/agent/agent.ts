import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { createLogger } from './utils/logger.js';
import { ClientManager, ExternalServerConfig, ExternalTool } from './mcp/client/manager.js';
 

const logger = createLogger('Agent');

const BASE_SYSTEM_PROMPT = `
你是一个乐于助人的 AI 助手。
回复内容请使用 Markdown 格式。
`;

export class Agent {
  private llm: BaseLanguageModel;
  private systemPrompt: string;
  private externalClientManager: ClientManager;
  // 已移除 allTools 缓存，避免状态陈旧与未使用字段
  public readonly ready: Promise<void>;
  private resolveReady!: () => void;

  constructor(
    llm: BaseLanguageModel,
    externalServers: ExternalServerConfig[] = [],
    systemPrompt: string
  ) {
    if (!llm) throw new Error("Agent 需要一个有效的 LLM 实例。");
    
    this.llm = llm;
    this.systemPrompt = systemPrompt || BASE_SYSTEM_PROMPT;
    this.externalClientManager = new ClientManager();

    logger.info('Agent 已创建。正在初始化外部服务...');
    this.ready = new Promise<void>((resolve) => { this.resolveReady = resolve; });
    this.initialize(externalServers);
  }

  public get languageModel(): BaseLanguageModel {
    return this.llm;
  }

  public get clientManager(): ClientManager {
    return this.externalClientManager;
  }

  public get systemPromptValue(): string {
    return this.systemPrompt;
  }

  // 资源池相关功能已移除

  /**
   * 按需获取当前可用工具列表（透传自 ClientManager，避免本地缓存陈旧）。
   */
  public async listTools(): Promise<ExternalTool[]> {
    return this.externalClientManager.getAllTools();
  }

  private async initialize(externalServers: ExternalServerConfig[]) {
    try {
      await this.externalClientManager.connect(externalServers);
      const tools = await this.externalClientManager.getAllTools();
      logger.info('Agent 初始化完成。');
      logger.info(`发现了 ${tools.length} 个外部工具。`);
      this.resolveReady();
    } catch (error) {
      logger.error('Agent 初始化失败', error);
      throw error;
    }
  }

  // 旧的单步流程与相关私有方法已移除；Agent 仅作为依赖提供者
}
