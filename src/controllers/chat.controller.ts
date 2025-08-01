import { Request, Response, NextFunction } from 'express';
import { runChatStream, getMCPAgentStatus } from '../services/index.js';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { createLogger } from '../utils/logger.js';

// 创建logger实例
const logger = createLogger('ChatController');

// MCP功能已集成到统一的聊天服务中，无需环境变量控制

/**
 * 获取MCP代理状态
 */
export function getMCPStatus(req: Request, res: Response) {
  try {
    const status = getMCPAgentStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error getting MCP status', error);
    res.status(500).json({
      error: 'Failed to get MCP status',
      initialized: false,
      enabled: true // MCP 默认启用，由配置中心管理
    });
  }
}

/**
 * 将通用的消息对象数组转换为 LangChain 的 BaseMessage 实例数组。
 * @param {Array<{role: string, content: string}>} genericMessages - 从客户端接收的通用消息数组。
 * @returns {BaseMessage[]} LangChain 的 BaseMessage 实例数组。
 */
function mapToLangChainMessages(genericMessages: {role: string, content: string}[]): BaseMessage[] {
  return genericMessages.map(msg => {
    if (msg.role === 'user') {
      return new HumanMessage(msg.content);
    } else if (msg.role === 'assistant') {
      return new AIMessage(msg.content);
    }
    // 可以根据需要扩展以支持 SystemMessage 等
    throw new Error(`Unknown message role: ${msg.role}`);
  });
}

/**
 * 创建一个通用的聊天流处理器，以减少代码重复。
 * @param {boolean} useMcp - 是否启用MCP（决定是否传递sessionId）。
 */
function createChatStreamHandler(useMcp: boolean) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const controllerName = useMcp ? 'SmartChat' : 'RegularChat';

    0 && logger.info(`[${controllerName}] Starting stream request ${requestId}`, {
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
    });

    try {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        const error: any = new Error('Request body must include a non-empty "messages" array.');
        error.status = 400;
        logger.error(`[${controllerName}] Invalid request for ${requestId}`, error);
        return next(error);
      }
      
      const langChainMessages = mapToLangChainMessages(messages);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      const stream = await runChatStream(langChainMessages, useMcp ? requestId : undefined);

      const streamStartTime = Date.now();
      for await (const chunk of stream) {
        res.write(chunk);
      }
      
      if (useMcp) {
          const streamDuration = Date.now() - streamStartTime;
          logger.info(`Performance: [${controllerName}] Stream completed for ${requestId}`, { executionTime: `${streamDuration}ms` });
      }

      res.end();
    } catch (error) {
      logger.error(`[${controllerName}] Error in stream controller for ${requestId}`, error);

      if (!res.headersSent) {
        next(error);
      } else {
        logger.error(`[${controllerName}] Headers already sent for ${requestId}, ending response.`);
        res.end();
      }
    }
  };
}

/**
 * 处理智能聊天请求的控制器（支持MCP工具调用）。
 */
export const handleSmartChatStream = createChatStreamHandler(true);

/**
 * 处理常规聊天请求的控制器（不使用MCP工具调用）。
 */
export const handleRegularChatStream = createChatStreamHandler(false); 
