import type { User } from '@/types/user.js'
import bcrypt from 'bcrypt'
import { globals } from '@/globals.js'

/**
 * 注册新用户
 * @param {string} username - 用户名
 * @param {string} email - 邮箱
 * @param {string} password - 原始密码
 * @returns {Promise<Omit<User, 'password_hash'>>} - 创建成功后的用户信息（不含密码哈希）
 * @throws {Error} - 如果用户名或邮箱已存在，则抛出错误
 */
export async function registerUser(username: string, email: string, password: string): Promise<Omit<User, 'password_hash'>> {
    const pool = globals.pgPool
    if (!pool)
        throw new Error('Database connection is not available.')

    // 1. 哈希密码
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // 2. 将用户存入数据库
    const query = `
    INSERT INTO users (username, email, password_hash)
    VALUES ($1, $2, $3)
    RETURNING id, username, email, created_at, updated_at;
  `
    const values = [username, email, passwordHash]

    try {
        const result = await pool.query(query, values)
        return result.rows[0]
    }
    catch (error: any) {
        // 处理唯一约束冲突（用户名或邮箱已存在）
        if (error.code === '23505') {
            if (error.constraint === 'users_username_key')
                throw new Error('Username already exists.')
            if (error.constraint === 'users_email_key')
                throw new Error('Email already exists.')
        }
        throw error
    }
}
