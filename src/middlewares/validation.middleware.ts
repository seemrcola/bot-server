import type { NextFunction, Request, Response } from 'express'
import type { AnyZodObject } from 'zod'
import { ZodError } from 'zod'

/**
 * Zod 校验中间件
 * @param {AnyZodObject} schema - 用于校验的 Zod schema
 * @returns {Function} - Express 中间件函数
 */
export function validate(schema: AnyZodObject) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            // 异步解析请求的 body, query 和 params
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            })
            // 校验成功，进入下一个中间件
            return next()
        }
        catch (error) {
            // 如果是 Zod 校验错误
            if (error instanceof ZodError) {
                // 将所有错误信息拼接成一个字符串
                const errorMessages = error.errors.map(e => e.message).join(', ')
                return res.status(400).json({ success: false, message: errorMessages })
            }
            // 其他类型的错误，交由全局错误处理器处理
            return next(error)
        }
    }
}
