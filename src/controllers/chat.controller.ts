import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/index.js';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ChatController');

/**
 * 获取 MCP 代理和服务的状态
 */
export function getMCPStatus(req: Request, res: Response) {
  try {
    const status = chatService.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error getting MCP status', error);
    res.status(500).json({
      error: 'Failed to get MCP status',
      initialized: false,
    });
  }
}

/**
 * 将通用的消息对象数组转换为 LangChain 的 BaseMessage 实例数组。
 */
function mapToLangChainMessages(genericMessages: {role: string, content: string}[]): BaseMessage[] {
  return genericMessages.map(msg => {
    if (msg.role === 'user') {
      return new HumanMessage(msg.content);
    } else if (msg.role === 'assistant') {
      return new AIMessage(msg.content);
    }
    throw new Error(`Unknown message role: ${msg.role}`);
  });
}

/**
 * 处理聊天流请求的统一控制器。
 */
async function handleChatStream(req: Request, res: Response, next: NextFunction) {
    const requestId = `req_${Date.now()}`;
    logger.info(`Starting stream request ${requestId}`);

    try {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        const error: any = new Error('Request body must include a non-empty "messages" array.');
        error.status = 400;
        return next(error);
      }
      
      const langChainMessages = mapToLangChainMessages(messages);

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      const stream = await chatService.runChatStream(langChainMessages, requestId);

      for await (const chunk of stream) {
        res.write(chunk);
      }
      
      res.end();
    } catch (error) {
      logger.error(`Error in stream controller for ${requestId}`, error);

      if (!res.headersSent) {
        next(error);
      } else {
        res.end();
      }
    }
}


// 导出控制器
// 注意：旧的 handleSmartChatStream 和 handleRegularChatStream 已被统一
export const streamChatHandler = handleChatStream;
