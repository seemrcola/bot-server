import type { BaseMessage } from '@langchain/core/messages'
import { runWithLeader } from '@/_orchestration/index.js'
import { globals } from '@/globals.js' // 从全局容器导入
import { createLogger } from '@/utils/logger.js'

const logger = createLogger('ChatService')

async function ensureBootstrap(): Promise<void> {
    if (globals.agentManager)
        return
    if (globals.agentManagerReady) {
        await globals.agentManagerReady
        return
    }
    throw new Error('AgentManager 尚未初始化（缺少全局就绪 Promise）。')
}

/**
 * ChatService 类是整个应用的核心，负责管理聊天请求、Agent 实例、系统提示词等。
 * 它通过 AgentManager 管理 Agent 实例，并提供 runChainStream 方法来处理聊天请求。
 * @param messages - 聊天消息
 * @param options - 聊天选项
 * @returns 流式聊天响应
 */
class ChatService {
    /**
     * 基于Agent链式处理的流式聊天：
     * 1) 意图分析 - 判断是否需要使用工具
     * 2) 执行 - 根据意图选择直接LLM回答或ReAct模式
     * 3) 增强回复 - 对ReAct结果进行增强处理
     */
    public async runChainStream(
        messages: BaseMessage[],
        options: {
            maxSteps?: number // 最大步骤数
            agentName?: string // 指定Agent名称
            reactVerbose?: boolean // ReAct模式下是否启用详细模式
            temperature?: number // 模型温度
            routingThreshold?: number // Agent路由的置信度阈值（默认值来自ROUTING_CONFIDENCE.MULTI_AGENT_THRESHOLD）
            maxAgents?: number // 最大Agent数量（默认值来自AGENT_LIMITS.DEFAULT_MAX_AGENTS，支持1-N个Agent）
        },
    ): Promise<AsyncIterable<string>> {
        await ensureBootstrap()
        const agentManager = globals.agentManager
        if (!agentManager) {
            logger.error('严重错误: AgentManager 未初始化！')
            throw new Error('AgentManager 尚未初始化，无法处理聊天请求。')
        }
        // 使用统一的Agent编排接口
        return runWithLeader(messages, {
            maxSteps: options.maxSteps,
            reactVerbose: options.reactVerbose,
            temperature: options.temperature,
            agentName: options.agentName,
            routingThreshold: options.routingThreshold,
            maxAgents: options.maxAgents,
        })
    }
}

// 导出 ChatService 的单例
export const chatService = new ChatService()
