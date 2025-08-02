import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { BaseMessage } from "@langchain/core/messages";
import { createLogger } from '../../utils/logger.js';
import { MCPAgent } from '../../mcp/index.js';
import { MCPService } from '../../mcp/service.js';

// 从环境变量中获取LLM配置
const LLMApiKey = process.env["LLM_API_KEY"];
const LLMName = process.env["LLM_MODEL"] || 'deepseek-chat';
const LLMUrl = process.env["LLM_BASE_URL"];

const logger = createLogger('ChatService');

class ChatService {
  
  private getAgent(): MCPAgent | null {
    try {
      return MCPService.getInstance().getAgent();
    } catch (error) {
      logger.warn("MCPAgent is not available at this moment.", { reason: error });
      return null;
    }
  }

  /**
   * 运行一个支持对话历史和MCP工具调用的流式聊天链。
   */
  public async runChatStream(messages: BaseMessage[], sessionId?: string): Promise<AsyncIterable<string>> {
    const agent = this.getAgent();
    const lastMessage = messages[messages.length - 1];
    const userMessage = lastMessage?.content as string;

    if (agent && userMessage && (await this.checkIfNeedsToolCall(agent, userMessage))) {
        logger.info('Message needs tool call, using progressive streaming...');
        return this.createProgressiveToolCallStream(agent, userMessage, {
          messages,
          sessionId: sessionId || 'default',
        });
    }

    logger.info('Simple chat detected, using direct LLM streaming...');
    return this.createDirectLLMStream(messages);
  }

  /**
   * 获取MCP代理和服务的状态
   */
  public getStatus(): any {
    const agent = this.getAgent();
    if (!agent) {
      return {
        initialized: false,
        enabled: true,
        reason: 'Agent not available or MCPService not started.'
      };
    }
    return { ...agent.getStatus(), enabled: true };
  }

  /**
   * 创建一个直接调用LLM的流
   */
  private async createDirectLLMStream(messages: BaseMessage[]): Promise<AsyncIterable<string>> {
    if (!LLMApiKey) {
        throw new Error("LLM_API_KEY environment variable not set for direct LLM call");
    }
    const systemPrompt = `你是一个专业的AI助手...`; // (提示词内容省略)
    const chatModel = this.getChatModel();
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      new MessagesPlaceholder("messages"),
    ]);
    const outputParser = new StringOutputParser();
    const chain = prompt.pipe(chatModel).pipe(outputParser);
    return chain.stream({ messages });
  }

  /**
   * 快速判断消息是否需要工具调用
   */
  private async checkIfNeedsToolCall(agent: MCPAgent, message: string): Promise<boolean> {
    const status = agent.getStatus();
    const availableTools = status.registeredTools || [];
    const lowerMessage = message.toLowerCase();

    // 检查是否包含工具名称
    for (const tool of availableTools) {
      if (lowerMessage.includes(tool.toLowerCase())) return true;
    }

    // 动态获取所有工具的关键词
    const allKeywords = agent.getAllToolKeywords();
    for (const keyword of allKeywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) return true;
    }

    // 通用的工具调用关键词
    const genericKeywords = ['调用', '使用', '工具', 'tool', 'call'];
    for (const keyword of genericKeywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) return true;
    }

    return false;
  }

  /**
   * 创建渐进式工具调用流式输出
   */
  private async* createProgressiveToolCallStream(agent: MCPAgent, userMessage: string, context: any): AsyncIterable<string> {
    yield* agent.processMessageStream(userMessage, context);
  }

  /**
   * 获取聊天模型配置
   */
  private getChatModel(): ChatOpenAI {
    const config: any = {
      apiKey: LLMApiKey, model: LLMName, temperature: 0.7, streaming: true,
      configuration: { baseURL: LLMUrl }
    };
    return new ChatOpenAI(config);
  }
}

// 导出 ChatService 的单例
export const chatService = new ChatService();
