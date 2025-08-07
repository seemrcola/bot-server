import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { createLogger } from '../utils/logger.js';
import { ClientManager, ExternalServerConfig } from './mcp/client/manager.js';
import { Runnable } from "@langchain/core/runnables";
import { createToolCallingExecutor } from "./llm/index.js";

const logger = createLogger('Agent');

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
    this.systemPrompt = systemPrompt || "你是一个乐于助人的 AI 助手。";
    this.externalClientManager = new ClientManager();

    logger.info('Agent 已创建。正在初始化外部服务...');
    this.initialize(externalServers);
  }

  private async initialize(externalServers: ExternalServerConfig[]) {
    try {
      await this.externalClientManager.connect(externalServers);
      this.allTools = await this.externalClientManager.getAllTools();
      logger.info('Agent 初始化完成。');
      logger.info(`发现了 ${this.allTools.length} 个外部工具。`);
    } catch (error) {
      logger.error('Agent 初始化失败', error);
      throw error;
    }
  }

  /**
   * 分析用户最新消息的意图，判断是否需要调用工具。
   */
  private async _analyzeUserIntent(lastMessage: BaseMessage): Promise<any | null> {
    logger.info("开始执行意图分析...");
    
    let agentExecutor: Runnable = this.llm;
    if (this.allTools.length > 0) {
      console.log('this.allTools', this.allTools);
      const formattedTools = this.allTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        schema: tool.inputSchema,
      }));
      agentExecutor = createToolCallingExecutor(this.llm, formattedTools as any);
    } else {
      logger.info("无可用工具，跳过意图分析。");
      return null;
    }
    
    const intentAnalysisMessages: BaseMessage[] = [
      new HumanMessage(this.systemPrompt),
      lastMessage
    ];

    const intentResponse = await agentExecutor.invoke(intentAnalysisMessages);

    if (intentResponse.tool_calls && intentResponse.tool_calls.length > 0) {
      const toolCall = intentResponse.tool_calls[0];
      logger.info(`意图分析成功: 模型建议调用工具 -> ${toolCall.name}`);
      return toolCall;
    }
    
    logger.info("意图分析完成: 无需调用工具。");
    return null;
  }

  /**
   * 执行工具调用的逻辑分支。
   */
  private async *_executeToolCall(toolCall: any): AsyncIterable<string> {
    logger.info(`执行工具调用: ${toolCall.name}`);
    yield `正在调用工具: \`${toolCall.name}\`...\n`;
    try {
      const toolResult = await this.externalClientManager.callTool(toolCall.name, toolCall.args);
      logger.info(`工具 ${toolCall.name} 返回结果。`);
      
      const content = toolResult.content as string;
      if (typeof content !== 'string') {
        yield JSON.stringify(content);
      } 
      else {
        yield content;
      }
    } catch (error) {
      const errorMessage = `工具 \`${toolCall.name}\` 调用失败: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage, error);
      yield errorMessage;
    }
  }

  /**
   * 执行常规LLM调用的逻辑分支。
   */
  private async *_executeConventionalCall(messages: BaseMessage[]): AsyncIterable<string> {
    logger.info("执行常规LLM流式调用。");
    const history: BaseMessage[] = [
      new HumanMessage(this.systemPrompt), 
      ...messages
    ];
    
    const stream = await this.llm.stream(history);
    for await (const chunk of stream) {
      if (typeof chunk.content === 'string') {
        yield chunk.content;
      } 
      else if (Array.isArray(chunk.content)) {
        yield chunk.content.join("");
      }
    }
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

    const toolCall = await this._analyzeUserIntent(lastMessage);

    // 如果需要调用工具，则执行工具调用逻辑
    if (toolCall) {
      yield* this._executeToolCall(toolCall);
    } 
    // 否则执行常规LLM调用逻辑
    else {
      yield* this._executeConventionalCall(messages);
    }
  }
}
