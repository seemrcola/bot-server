import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat/chat.service.js';
import { createLogger } from '../utils/logger.js';
import { BaseMessage } from "@langchain/core/messages";
// 资源池相关逻辑已移除

const logger = createLogger('ChatController');

export async function streamChatHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { messages, sessionId, reactVerbose } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res
        .status(400)
        .json({ error: 'messages are required in the request body and must be a non-empty array.' });
      return;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.flushHeaders();

    logger.info('开始处理流式聊天请求 (ReAct 模式)', { sessionId });

    // 资源池相关逻辑已移除

    // 通过 Service 统一调度（保持分层）
    const stream = await chatService.runReActStream(messages as BaseMessage[], { maxSteps: 8 });

    if (reactVerbose === true) {
      // 输出严格的 ReAct JSON 步骤
      for await (const step of stream) {
        res.write(step + "\n");
      }
    } else {
      // 仅输出最终答案文本
      for await (const step of stream) {
        try {
          const obj = JSON.parse(step);
          if (obj?.action === 'final_answer') {
            const answerVal = obj?.answer;
            const answer = typeof answerVal === 'string' ? answerVal : JSON.stringify(answerVal);
            res.write(answer);
          }
        } catch {
          // 忽略解析失败的中间步骤
        }
      }
    }

    res.end();

    logger.info('流式聊天请求处理完成', { sessionId });

  } catch (error) {
    logger.error('处理流式聊天请求时出错', error);
    next(error);
  }
}
