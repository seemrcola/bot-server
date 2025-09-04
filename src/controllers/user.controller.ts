import type { NextFunction, Request, Response } from 'express'
import { registerUser } from '@/services/user/user.service.js'

/**
 * 处理用户注册请求
 * @param {Request} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @param {NextFunction} next - Express next 中间件函数
 */
export async function handleRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { username, email, password } = req.body

        // 校验逻辑已移至 validation.middleware.ts

        // 调用服务层来创建用户
        const user = await registerUser(username, email, password)

        // 发送成功的响应
        res.status(201)
            .json({
                success: true,
                data: user,
                message: 'User registered successfully.',
            })
    }
    catch (error: any) {
        // 如果是服务层抛出的特定错误（如用户名已存在），则返回 409 Conflict
        if (
            error.message === 'Username already exists.'
            || error.message === 'Email already exists.'
        ) {
            res.status(409)
                .json({
                    success: false,
                    message: error.message,
                })
        }
        else {
            // 其他错误交由全局错误处理中间件处理
            next(error)
        }
    }
}
