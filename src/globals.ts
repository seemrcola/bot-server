import type { Pool } from 'pg'
import type { AgentManager } from './_orchestration/index.js'

/**
 * 全局变量，用于存储应用级别的单例或状态
 */
export const globals: {
    agentManager: AgentManager | null
    agentManagerReady: Promise<void> | null
    pgPool: Pool | null
} = {
    agentManager: null,
    agentManagerReady: null,
    pgPool: null,
}
