/**
 * Orchestration 模块统一出口
 */

// 启动编排（Leader + 子 Agent 注册）
export { initLeaderOrchestration } from './bootstrap.js'

// Dashboard 子 Agent 集合（集中导出）
export { dashboards } from './Dashboard/index.js'

// Leader 模块（集中导出）
export { default as leader } from './Leader/index.js'

// Agent 管理器（供需要时直接操作管理器的场景使用）
export { AgentManager } from './manager.js'

// 运行编排（显式 → 多Agent → LLM → Leader 兜底），对外唯一执行入口
export { runWithLeader, runWithMultipleAgents } from './orchestrator.js'

// LLM 路由（如需单独调用）
export { selectAgentByLLM, selectMultipleAgentsByLLM } from './router.js'
