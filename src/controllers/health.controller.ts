import type { NextFunction, Request, Response } from 'express'
import process from 'node:process'

/**
 * 处理健康检查请求的控制器。
 * @param {Request} req - Express 请求对象。
 * @param {Response} res - Express 响应对象。
 * @param {NextFunction} next - Express next 中间件函数。
 */
export function getHealthStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const healthData = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        }

        // 将要发送的数据存放到 res.locals 中
        res.locals['data'] = healthData

        // 调用 next() 将请求传递给成功响应处理中间件
        next()
    }
    catch (error) {
    // 如果发生同步错误，传递给错误处理中间件
        next(error)
    }
}
