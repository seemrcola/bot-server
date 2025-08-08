import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat/chat.service.js';
import { createLogger } from '../utils/logger.js';
import { BaseMessage } from "@langchain/core/messages";

const logger = createLogger('ChatController');

export async function streamChatHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { messages, sessionId, reactVerbose } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res
        .status(400)
        .json({error: 'messages are required in the request body and must be a non-empty array.' });
      return;
    }
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.flushHeaders();

    logger.info('开始处理流式聊天请求 (ReAct 模式)', { sessionId });

    // 通过 Service 统一调度（保持分层）
    const stream = await chatService.runReActStream(messages as BaseMessage[], { maxSteps: 8 });

    for await (const step of stream) {
      // 每一步都是 JSON 字符串
      if (reactVerbose) {
        // 兼容：需要完整 ReAct 轨迹时直接透传
        res.write(step + '\n');
        continue;
      }

      // 默认：只向客户端输出最终答案，步骤仅写入服务端日志
      try {
        const obj = JSON.parse(step);
        const action = obj?.action;
        if (action === 'tool_call') {
          logger.debug('ReAct step tool_call', { tool: obj?.action_input?.tool_name, params: obj?.action_input?.parameters });
          continue;
        }
        if (action === 'user_input') {
          logger.debug('ReAct step user_input', { thought: obj?.thought });
          continue;
        }
        if (action === 'final_answer') {
          const answer: unknown = obj?.answer;
          const text = typeof answer === 'string' ? answer : JSON.stringify(answer);
          res.write(text);
        }
      } catch {
        // 若解析失败，降级为直接输出原始文本，避免丢失信息
        res.write(step + '\n');
      }
    }

    res.end();
    
    logger.info('流式聊天请求处理完成', { sessionId });

  } catch (error) {
    logger.error('处理流式聊天请求时出错', error);
    next(error);
  }
}
