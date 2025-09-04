import process from 'node:process'
import { Pool } from 'pg'

/**
 * PostgreSQL 连接池
 * @description 使用 pg 的 Pool 来管理数据库连接，以提高性能和可靠性。
 * @see https://node-postgres.com/features/pooling
 */
async function initPool() {
    return new Pool({
        user: process.env['DB_USER'], // 用户名
        host: process.env['DB_HOST'], // 主机
        database: process.env['DB_DATABASE'], // 数据库名称
        password: process.env['DB_PASSWORD'], // 密码
        port: Number(process.env['DB_PORT']), // 端口
    })
}

/**
 * 测试数据库连接
 * @description 尝试从连接池中获取一个客户端并立即释放，以验证数据库连接是否正常。
 * @returns {Promise<void>} - 如果连接成功，则 Promise resolve，否则 reject。
 * @throws {Error} - 如果连接失败，则抛出错误。
 */
export async function testConnection(): Promise<Pool> {
    const pool = await initPool()
    return new Promise((resolve, reject) => {
        pool.connect((err, client, release) => {
            if (err) {
                // 直接 reject 原始错误，而不是创建一个新错误
                // 这样可以保留详细的错误信息，便于调试
                return reject(err)
            }

            console.log('PostgreSQL connected successfully.')
            // 释放客户端
            if (client)
                release()

            // 连接成功
            resolve(pool)
        })
    })
}
