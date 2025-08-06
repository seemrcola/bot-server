import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat/chat.service.js';
import { createLogger } from '../utils/logger.js';
import { BaseMessage } from "@langchain/core/messages";

const logger = createLogger('ChatController');

/**
 * 流式聊天处理器
 */
export async function streamChatHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { messages, sessionId } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages are required in the request body and must be a non-empty array.' });
      return;
    }
    
    // 设置一个简单的文本流响应头
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.flushHeaders();

    logger.info('开始处理流式聊天请求 (raw text stream)', { sessionId });

    // 调用聊天服务
    const stream = await chatService.runChatStream(messages as BaseMessage[], sessionId);

    // 将流式数据直接写入响应，不带任何SSE格式
    for await (const chunk of stream) {
      res.write(chunk);
    }

    // 结束响应
    res.end();
    
    logger.info('流式聊天请求处理完成', { sessionId });

  } catch (error) {
    logger.error('处理流式聊天请求时出错', error);
    next(error);
  }
}
