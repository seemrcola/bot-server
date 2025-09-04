import { z } from 'zod'

/**
 * 用户注册请求的校验 schema
 * @description 使用 Zod 定义请求体的校验规则
 * username: 用户名 3-15个字符
 * email: 邮箱
 * password: 密码 6-15个字符或者符号
 */
const usernamePattern = /^[\w-]{3,15}$/
const emailPattern = /^[\w.%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
const passwordPattern = /^[\w!@#$%^&*()+\-=[\]{};':"\\|,.<>/?]{6,15}$/
export const registerSchema = z.object({
    body: z.object({
        username: z
            .string()
            .min(3, '用户名至少需要3个字符。')
            .regex(usernamePattern, '用户名只能包含字母、数字、下划线和短划线。'),
        email: z
            .string()
            .email('无效的邮箱格式。')
            .regex(emailPattern, '无效的邮箱格式。'),
        password: z
            .string()
            .min(6, '密码至少需要6个字符。')
            .regex(passwordPattern, '密码只能包含字母、数字和符号。'),
    }),
})
