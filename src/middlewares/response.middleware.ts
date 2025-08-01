/**
 * 响应处理中间件
 */
import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ResponseMiddleware');

/**
 * 成功响应处理中间件
 */
export function handleSuccess(req: Request, res: Response, next: NextFunction) {
  // 如果响应已经发送，跳过
  if (res.headersSent) {
    return next();
  }
  
  // 如果没有响应数据，继续到错误处理
  next();
}

/**
 * 错误处理中间件
 */
export function handleError(error: any, req: Request, res: Response, next: NextFunction) {
  logger.error('Request error', {
    method: req.method,
    url: req.url,
    error: error.message,
    stack: error.stack
  });

  // 如果响应已经发送，跳过
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || error.status || 500;
  const message = error.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env["NODE_ENV"] === 'development' && { stack: error.stack })
    }
  });
}