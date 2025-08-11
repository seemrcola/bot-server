import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat/chat.service.js';
import { createLogger } from '../utils/logger.js';
import { BaseMessage } from "@langchain/core/messages";
// 资源池相关逻辑已移除

const logger = createLogger('ChatController');

export async function streamChatHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { messages, sessionId, reactVerbose, agentName, strategy } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res
        .status(400)
        .json({ error: 'messages are required in the request body and must be a non-empty array.' });
      return;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.flushHeaders();

    logger.info('开始处理流式聊天请求 (意图分析 + 流式输出)', { sessionId });

    // 资源池相关逻辑已移除

    // 先进行意图分析。若无需工具，则直接以 Markdown 流式输出答案
    const analyzed = await chatService.runStreamWithIntent(messages as BaseMessage[], { maxSteps: 8, agentName, strategy });

    if (analyzed.mode === 'direct') {
      for await (const chunk of analyzed.stream) {
        res.write(chunk);
      }
    } else {
      const stream = analyzed.stream;
      if (reactVerbose === true) {
        // 输出严格的 ReAct JSON 步骤
        for await (const step of stream) {
          res.write(step + "\n");
        }
      } else {
        // 友好增强：打印工具调用与结果，并在最终答案后附“信息小结”
        const enhance = createFriendlyEnhancer();
        for await (const step of stream) {
          const chunks = enhance(step);
          for (const c of chunks) res.write(c);
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

/**
 * 为 ReAct 流式步骤提供按模式的输出增强，同时在 final 时合成更友好的答案。
 * 已避免同一步前后各打一遍导致的重复输出（仅在收到 observation 时打印）。
 */
function createFriendlyEnhancer() {
  const observations: string[] = [];

  function enhanceFinal(answerVal: unknown): string {
    const answer = typeof answerVal === "string" ? answerVal : JSON.stringify(answerVal);
    if (observations.length === 0) return answer;
    const summary = observations.map((o) => `- ${o}`).join("\n");
    return `${answer}\n\n—— 信息小结 ——\n${summary}`;
  }

  return function enhance(stepJson: string): string[] {
    let obj: any = null;
    try { obj = JSON.parse(stepJson); } catch { return [stepJson + "\n"]; }

    const action = obj?.action;

    if (action === "tool_call") {
      if (!obj?.observation) return [];
      observations.push(obj.observation);
      const tool = obj?.action_input?.tool_name;
      const prettyArgs = JSON.stringify(obj?.action_input?.parameters ?? {});
      return [
        `正在调用工具: ${tool}，参数: ${prettyArgs}\n`,
        `工具结果: ${obj.observation}\n`,
      ];
    }

    if (action === "user_input") {
      return [`需要更多信息：${obj?.thought || "请补充说明"}\n`];
    }

    if (action === "final_answer") {
      const text = enhanceFinal(obj?.answer);
      return [text];
    }

    return [stepJson + "\n"];
  };
}
