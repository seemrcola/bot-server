import type { Express } from 'express'

import process from 'node:process'
import cors from 'cors'
import express from 'express'
import { initLeaderOrchestration } from './_orchestration/index.js'
import { pg } from './db/index.js'
import { applyMigrations } from './db/migration.js'
import { globals } from './globals.js'
import { handleError, handleSuccess } from './middlewares/response.middleware.js'
import { mainRouter } from './routes/index.js'
import { createLogger } from './utils/logger.js'

import 'dotenv/config'

const app: Express = express()
const logger = createLogger('MainServer')

// --- 中间件配置 ---
app.use(express.static('public'))
app.use(express.json())
app.use(cors())
// 处理预检请求（OPTIONS）
app.options('*', cors())

// --- 路由配置 ---
app.use('/', mainRouter)

// --- 响应处理中间件 (必须放在路由之后) ---
app.use(handleSuccess)
app.use(handleError)

/**
 * 初始化数据库连接和迁移
 * @description 尝试连接数据库并应用迁移。如果失败，将记录警告但不会中止应用启动。
 */
async function initializeDatabase() {
    try {
        // 1. 测试数据库连接
        const pool = await pg.testConnection()
        globals.pgPool = pool
        logger.info('数据库连接成功')

        // 2. 应用数据库迁移
        await applyMigrations(pool)
        logger.info('数据库迁移检查完成')
    }
    catch (error: any) {
        logger.warn('数据库初始化失败，依赖数据库的功能将不可用', { error: error.message })
        globals.pgPool = null
    }
}

/**
 * 初始化 AgentManager 并启动服务器
 */
(async () => {
    // 1. 初始化数据库（非阻塞）
    await initializeDatabase()

    // 2. 初始化 AgentManager (关键服务)
    try {
        globals.agentManagerReady = (async () => {
            const agentManager = await initLeaderOrchestration([])
            globals.agentManager = agentManager
            logger.info('AgentManager 已创建并注册 Leader')
        })()
        await globals.agentManagerReady
    }
    catch (error) {
        logger.error('AgentManager 初始化失败，应用无法启动', error)
        process.exit(1) // AgentManager 是核心，如果失败则必须退出
    }
})()

// 启动服务器监听端口
const port = Number(process.env['PORT'])
app.listen(port, () => {
    logger.info('API 服务器已启动', { 端口: port })
})

export default app
