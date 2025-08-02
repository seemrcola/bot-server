/**
 * @file chat.route.ts
 * @description 聊天路由
 */
import { Router, Request, Response, NextFunction } from 'express';
import { streamChatHandler, getMCPStatus } from '../controllers/chat.controller.js';

const chatRouter: Router = Router();

/**
 * @route POST /stream
 * @description 统一的对话流式 API 端点。
 *              内部会自动判断是否需要调用工具，提供最佳的聊天体验。
 */
chatRouter.post('/stream', (req: Request, res: Response, next: NextFunction) => {
  streamChatHandler(req, res, next).catch(next);
});

/**
 * @route GET /mcp/status
 * @description 获取MCP代理和服务状态
 */
chatRouter.get('/mcp/status', getMCPStatus);

export { chatRouter };
