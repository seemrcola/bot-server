import { Router } from 'express';
import { streamChatHandler } from '../controllers/chat.controller.js';

const chatRouter: Router = Router();

/**
 * @swagger
 * /chat/stream:
 *   post:
 *     summary: 创建一个流式聊天会话
 *     description: 向聊天机器人发送消息并接收流式响应。
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *               sessionId:
 *                 type: string
 *     responses:
 *       '200':
 *         description: 成功，返回流式响应
 */
chatRouter.post('/stream', streamChatHandler);

export { chatRouter };
