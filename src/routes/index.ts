import { Router, Request, Response } from 'express';
import { chatRouter } from './chat.route.js';
import { healthRouter } from './health.route.js';

/**
 * 创建并配置主应用路由。
 * @returns {Router} 返回一个 Express Router 实例。
 */
function createMainRouter(): Router {
  const router = Router();

  /**
   * @route GET /
   * @description 根路径的 GET 请求处理器。
   *              用于检查服务器是否正在运行。
   * @param {Request} req - Express 请求对象。
   * @param {Response} res - Express 响应对象。
   */
  router.get('/', (_req: Request, res: Response) => {
    res.send('Server is running and refactored according to the new rules!');
  });

  // 挂载 API 路由
  router.use('/api/chat', chatRouter);
  router.use('/api/health', healthRouter);

  return router;
}

export const mainRouter = createMainRouter();
