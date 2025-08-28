import type { Express } from 'express'
import process from 'node:process'
import cors from 'cors'
import express from 'express'
import { config } from './config/index.js'
import { globals } from './globals.js'
import { handleError, handleSuccess } from './middlewares/response.middleware.js'
import { initLeaderOrchestration } from './orchestration/index.js'
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
app.use(handleError);

/**
 * 初始化 AgentManager 并启动服务器
 * 在后台执行初始化，避免阻塞应用启动
 */
(async () => {
    try {
        // 构建全局就绪 Promise（集中初始化）
        globals.agentManagerReady = (async () => {
            // 创建编排工具
            const agentManager = await initLeaderOrchestration([])
            globals.agentManager = agentManager
            logger.info(`AgentManager 已创建并注册 Leader`)
        })()
        await globals.agentManagerReady
    }
    catch (error) {
        logger.error('初始化失败', error)
    }
})()

// 启动服务器监听端口
const port = Number(process.env['PORT']) || config.port
app.listen(port, () => {
    logger.info('API 服务器已启动', { 端口: port })
})

export default app
