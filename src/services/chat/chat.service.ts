import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { BaseMessage } from "@langchain/core/messages";
import { createLogger } from '../../utils/logger.js';
import { MCPAgent } from '../../mcp/index.js';

// 从环境变量中获取LLM配置
const LLMApiKey = process.env["LLM_API_KEY"];
const LLMName = process.env["LLM_MODEL"] || 'deepseek-chat';
const LLMUrl = process.env["LLM_BASE_URL"];

// 系统提示词 - 确保回复格式正确和专业
const systemPrompt = `你是一个专业的AI助手，请遵循以下回复规范：

1. **代码回复格式**：当用户请求代码时，请使用Markdown代码块格式：
   - JavaScript代码：使用 \`\`\`javascript 代码块
   - Python代码：使用 \`\`\`python 代码块
   - 其他语言：使用相应的语言标识符

2. **回复风格**：
   - 保持友好、专业和有用的态度
   - 提供清晰、准确的回答
   - 如果用户用中文提问，请用中文回复
   - 如果用户用英文提问，请用英文回复

3. **代码示例**：
   - 提供完整、可运行的代码示例
   - 添加必要的注释说明
   - 解释代码的功能和用途

4. **格式要求**：
   - 使用适当的Markdown格式
   - 保持回复结构清晰
   - 避免过于冗长的解释，但确保信息完整

请确保你的回复既专业又易于理解。`;

// 创建logger实例
const logger = createLogger('ChatService');

/**
 * 快速判断消息是否需要工具调用
 * 使用简单的关键词匹配，避免完整的LLM调用
 */
async function checkIfNeedsToolCall(agent: MCPAgent, message: string): Promise<boolean> {
  // 获取可用工具列表
  const status = agent.getStatus();
  const availableTools = status.registeredTools || [];

  // 简单的关键词匹配
  const lowerMessage = message.toLowerCase();

  // 检查是否包含工具名称
  for (const tool of availableTools) {
    if (lowerMessage.includes(tool.toLowerCase())) {
      return true;
    }
  }

  // 检查常见的工具调用关键词
  const toolCallKeywords = [
    'jojo', 'ゴゴゴ', 'mudamuda', '無駄',
    '调用', '使用', '工具', 'tool', 'call'
  ];

  for (const keyword of toolCallKeywords) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * 创建渐进式工具调用流式输出
 * 使用MCP Agent的新流式处理方法
 */
async function* createProgressiveToolCallStream(
  agent: MCPAgent,
  userMessage: string,
  context: any
): AsyncIterable<string> {
  // 直接使用Agent的流式处理方法
  yield* agent.processMessageStream(userMessage, context);
}



// MCP代理单例
let mcpAgent: MCPAgent | null = null;

/**
 * 初始化MCP代理
 */
async function initMCPAgent(): Promise<MCPAgent | null> {
  try {
    if (!mcpAgent) {
      logger.info('Initializing MCP Agent');
      
      // 创建MCP Agent实例
      mcpAgent = new MCPAgent();

      // 配置MCP Agent的LLM 支持链式配置
      mcpAgent.configureLLM({
        apiKey: LLMApiKey || '',
        model: LLMName || '',
        configuration: {
          baseURL: LLMUrl || ''
        }
      });

      await mcpAgent.initialize();
      logger.info('MCP Agent initialized successfully 🎉🎉🎉');
    }
    return mcpAgent;
  } catch (error) {
    logger.warn('Failed to initialize MCP Agent, continuing without MCP', error);
    return null;
  }
}

/**
 * 运行一个支持对话历史和MCP工具调用的流式聊天链。
 * 会自动判断是否需要调用MCP工具，无需外部控制。
 *
 * @param {BaseMessage[]} messages - 一个包含对话历史的消息数组。
 * @param {string} sessionId - 可选的会话ID，用于MCP上下文
 * @returns {Promise<AsyncIterable<string>>} 返回一个 Promise，该 Promise 解析为一个可异步迭代的流。
 * @throws {Error} 如果 `LLM_API_KEY` 环境变量未设置，则抛出错误。
 */
export async function runChatStream(messages: BaseMessage[], sessionId?: string): Promise<AsyncIterable<string>> {
  if (!LLMApiKey) {
    throw new Error("LLM_API_KEY environment variable not set");
  }

  let finalMessages = messages;
  const lastMessage = messages[messages.length - 1];
  const userMessage = lastMessage?.content as string;

  if (userMessage) {
    try {
      const agent = await initMCPAgent();
      if (agent && agent.isInitialized()) {
        logger.info('Checking if message needs MCP processing...');

        // 先快速判断是否需要工具调用（不执行完整处理）
        const needsToolCall = await checkIfNeedsToolCall(agent, userMessage);

        if (needsToolCall) {
          logger.info('Message needs tool call, using progressive streaming...');

          // 使用渐进式流式处理工具调用
          return createProgressiveToolCallStream(agent, userMessage, {
            messages,
            sessionId: sessionId || 'default',
          });
        } else {
          logger.info('Simple chat detected, using direct LLM streaming...');
          // 简单对话，直接使用LLM流式处理，不经过MCP Agent
          // 这样可以获得真正的流式输出
        }

      } else {
        logger.info('MCP Agent not available, using regular chat');
      }
    } catch (error) {
      logger.warn('Error during MCP processing, falling back to regular chat', error);
    }
  }

  // -- 如果Agent没有直接给出最终答案，则继续执行LLM调用 --

  const chatModel = getChatModel();
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    /**
     * 创建占位符：在提示模板中预留一个位置，名为 "messages"
     * 这个占位符可能会在后续的逻辑中被填充
     */
    new MessagesPlaceholder("messages"),
  ]);

  const outputParser = new StringOutputParser();              // 输出解析器 将模型输出解析为字符串
  const chain = prompt.pipe(chatModel).pipe(outputParser);    // 创建链式调用 将提示模板、模型和输出解析器连接起来

  logger.info("Streaming chat with DeepSeek...", {
    messageCount: finalMessages.length,
    hasToolResult: finalMessages !== messages,
    sessionId: sessionId || 'default'
  });

  // 调用流式响应
  const stream = await chain.stream({
    messages: finalMessages, // 这个消息会填充到上面的占位符上
  });

  return stream;
}

/**
 * 获取聊天模型配置
 */
function getChatModel(): ChatOpenAI {  
  const config: any = {
    apiKey: LLMApiKey,
    model: LLMName,
    temperature: 0.7,
    streaming: true,
    configuration: {
      baseURL: LLMUrl
    }
  };
  
  const model = new ChatOpenAI(config);
  return model;
}

/**
 * 关闭MCP代理
 */
export async function shutdownMCPAgent(): Promise<void> {
  if (mcpAgent) {
    logger.info('Shutting down MCP Agent');
    await mcpAgent.shutdown();
    mcpAgent = null;
    logger.info('MCP Agent shutdown completed');
  }
}

/**
 * 获取MCP代理状态
 */
export function getMCPAgentStatus(): any {
  if (!mcpAgent) {
    return { 
      initialized: false, 
      enabled: true, // MCP 默认启用，由配置中心管理
      reason: 'Agent not initialized'
    };
  }
  return {
    ...mcpAgent.getStatus(),
    enabled: true // MCP 默认启用，由配置中心管理
  };
}
