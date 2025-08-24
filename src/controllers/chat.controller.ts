import type { BaseMessage } from '@langchain/core/messages'
import type { NextFunction, Request, Response } from 'express'
import { chatService } from '../services/chat/chat.service.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('ChatController')

export async function streamChatHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { messages, sessionId, reactVerbose, agentName, temperature } = req.body

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            res
                .status(400)
                .json({ error: 'messages are required in the request body and must be a non-empty array.' })
            return
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.flushHeaders()

        logger.info('开始处理流式聊天请求 (Agent链式处理)', { sessionId })

        // 使用Agent链式处理：意图分析 -> 执行 -> 增强回复
        const stream = await chatService.runChainStream(messages as BaseMessage[], {
            maxSteps: 8,
            agentName,
            reactVerbose,
            temperature,
        })

        // 直接流式输出结果
        for await (const chunk of stream) {
            res.write(chunk)
        }

        res.end()

        logger.info('流式聊天请求处理完成', { sessionId })
    }
    catch (error) {
        logger.error('处理流式聊天请求时出错', error)
        next(error)
    }
}
