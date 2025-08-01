/**
 * @file chat.route.ts
 * @description 聊天路由
 */
import { Router, Request, Response, NextFunction } from 'express';
import { handleSmartChatStream, getMCPStatus } from '../controllers/chat.controller.js';

const chatRouter: Router = Router();

/**
 * @route POST /stream
 * @description 智能对话流式 API 端点（支持MCP工具调用）。
 *              自动检测是否需要工具调用，提供最佳的聊天体验。
 */
chatRouter.post('/stream', (req: Request, res: Response, next: NextFunction) => {
  handleSmartChatStream(req, res, next).catch(next);
});

/**
 * @route GET /mcp/status
 * @description 获取MCP代理状态
 */
chatRouter.get('/mcp/status', getMCPStatus);

export { chatRouter };
