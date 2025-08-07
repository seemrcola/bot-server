import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat/chat.service.js';
import { createLogger } from '../utils/logger.js';
import { BaseMessage } from "@langchain/core/messages";

const logger = createLogger('ChatController');

export async function streamChatHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { messages, sessionId } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res
        .status(400)
        .json({error: 'messages are required in the request body and must be a non-empty array.' });
      return;
    }
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.flushHeaders();

    logger.info('开始处理流式聊天请求 (raw text stream)', { sessionId });

    // 注意 这里返回的是一个 AsyncIterable<string> 对象
    const stream = await chatService.runChatStream(messages as BaseMessage[], sessionId);

    // 注意 这里是一个异步迭代器，会自动处理流式数据 消费上面的 AsyncIterable<string> 对象
    for await (const chunk of stream) {
      res.write(chunk);
    }

    res.end();
    
    logger.info('流式聊天请求处理完成', { sessionId });

  } catch (error) {
    logger.error('处理流式聊天请求时出错', error);
    next(error);
  }
}
