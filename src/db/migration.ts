import type { Pool } from 'pg'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('Migration')

// 获取当前文件的目录
const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 应用数据库迁移
 * @description 读取 migrations 目录下的所有 .sql 文件并按顺序执行
 * @param {Pool} pool - PostgreSQL 连接池实例
 */
export async function applyMigrations(pool: Pool): Promise<void> {
    try {
        const migrationsDir = path.join(__dirname, 'migrations')
        const files = await fs.readdir(migrationsDir)
        const sqlFiles = files
            .filter(file => file.endsWith('.sql'))
            .sort() // 按文件名排序以保证执行顺序

        if (sqlFiles.length === 0) {
            logger.info('No migration files found.')
            return
        }

        logger.info('Applying migrations...')
        for (const file of sqlFiles) {
            const filePath = path.join(migrationsDir, file)
            const sql = await fs.readFile(filePath, 'utf8')

            // 在事务中执行迁移
            const client = await pool.connect()
            try {
                await client.query('BEGIN')
                await client.query(sql)
                await client.query('COMMIT')
                logger.info(`Migration ${file} applied successfully.`)
            }
            catch (error) {
                await client.query('ROLLBACK')
                logger.error(`Failed to apply migration ${file}:`, error)
                throw error // 停止后续迁移
            }
            finally {
                client.release()
            }
        }
        logger.info('All migrations applied successfully.')
    }
    catch (error) {
        logger.error('Migration failed:', error)
        throw error
    }
}
