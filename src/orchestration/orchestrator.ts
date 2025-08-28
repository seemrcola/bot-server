import type { BaseMessage } from '@langchain/core/messages'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { AgentChain } from '@/agent/index.js'
import { globals } from '@/globals.js'
import { createLogger } from '@/utils/logger.js'
import { selectAgentByLLM, selectMultipleAgentsByLLM } from './router.js'

function getLastHumanText(messages: BaseMessage[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
        const m: any = messages[i]
        const type = typeof m?.getType === 'function' ? m.getType() : m?._type ?? m?.type
        if (type === 'human') {
            const content = (m?.content ?? '') as any
            return typeof content === 'string' ? content : String(content ?? '')
        }
    }
    return ''
}

const logger = createLogger('OrchestrationRunner')

export interface OrchestratorOptions {
    maxSteps?: number | undefined // 最大执行步数，默认8
    reactVerbose?: boolean | undefined // 是否输出详细ReAct步骤
    temperature?: number | undefined // 采样温度
    agentName?: string | undefined // 显式指定要执行的 Agent；通常不指定，由系统进行 LLM 路由
    routingThreshold?: number | undefined // Agent路由的置信度阈值，默认0.5
    maxAgents?: number | undefined // 最大Agent数量，默认5（支持1-N个Agent）
    forceMultiAgent?: boolean | undefined // 是否强制使用多Agent路由，默认false
}

/**
 * 统一的Agent编排执行入口（支持1-N个Agent的统一处理）
 * 执行优先级：显式指定 → 智能路由选择 → Leader兜底
 * @param messages - 聊天消息
 * @param options - 聊天选项
 * @returns 流式聊天响应
 */
export async function runWithLeader(
    messages: BaseMessage[],
    options: OrchestratorOptions = {},
): Promise<AsyncIterable<string>> {
    const agentManager = globals.agentManager
    if (!agentManager) {
        logger.error('AgentManager 未初始化')
        throw new Error('AgentManager 尚未初始化')
    }

    // 1. 显式指定Agent（最高优先级）
    const explicitAgentName = (options.agentName ?? '').trim()
    if (explicitAgentName && agentManager.getAgent(explicitAgentName)) {
        const selectedAgents = [{
            name: explicitAgentName,
            reason: '用户显式指定',
            confidence: 1.0,
        }]
        logger.info(`显式指定模式：使用 Agent: ${explicitAgentName}`)
        return createUnifiedAgentStream(messages, selectedAgents, options)
    }

    // 2. 智能路由选择Agent（支持1-N个）
    const routingThreshold = options.routingThreshold ?? 0.5
    const maxAgents = options.maxAgents ?? 5
    const forceMultiAgent = options.forceMultiAgent ?? false

    // 尝试多Agent路由（如果配置允许或强制要求）
    if (forceMultiAgent || maxAgents > 1) {
        const [multiErr, multiData] = await selectMultipleAgentsByLLM({
            agentManager,
            messages,
            threshold: routingThreshold,
            maxAgents,
        })

        if (!multiErr && multiData && multiData.agents.length > 0) {
            logger.info(`智能多Agent路由：选择了 ${multiData.agents.length} 个Agent: ${multiData.agents.map(a => a.name).join(' -> ')}`)
            return createUnifiedAgentStream(messages, multiData.agents, options)
        }

        logger.warn(`多Agent路由失败（${multiErr}），回退到单Agent路由`)
    }

    // 3. 单Agent路由
    const [singleErr, singleData] = await selectAgentByLLM({
        agentManager,
        messages,
        threshold: routingThreshold,
    })

    if (!singleErr && singleData) {
        const selectedAgents = [singleData]
        logger.info(`智能单Agent路由：选择 Agent: ${singleData.name}（置信度: ${(singleData.confidence * 100).toFixed(1)}%）`)
        return createUnifiedAgentStream(messages, selectedAgents, options)
    }

    // 4. Leader兜底（保证总是有响应）
    const leaderName = agentManager.getLeaderName()!
    const selectedAgents = [{
        name: leaderName,
        reason: `兜底处理（路由失败: ${singleErr}）`,
        confidence: 1.0,
    }]
    logger.info(`Leader兜底模式：使用 Leader Agent: ${leaderName}`)
    return createUnifiedAgentStream(messages, selectedAgents, options)
}

/**
 * @deprecated 已废弃，请使用统一的 runWithLeader 函数
 * 为了向后兼容保留此函数，内部调用 runWithLeader
 */
export async function runWithMultipleAgents(
    messages: BaseMessage[],
    options: OrchestratorOptions = {},
): Promise<AsyncIterable<string>> {
    logger.warn('runWithMultipleAgents 已废弃，建议直接使用 runWithLeader')
    return runWithLeader(messages, { ...options, forceMultiAgent: true })
}

/**
 * 统一的Agent流式输出生成器（支持1-N个Agent）
 * 当只有1个Agent时，简化输出；多个Agent时显示详细的切换信息
 */
async function* createUnifiedAgentStream(
    messages: BaseMessage[],
    selectedAgents: Array<{ name: string, reason: string, confidence: number, task?: string }>,
    options: OrchestratorOptions,
): AsyncGenerator<string, void, unknown> {
    const agentManager = globals.agentManager!
    let currentMessages = [...messages]
    const isMultiAgent = selectedAgents.length > 1

    for (let i = 0; i < selectedAgents.length; i++) {
        const agentInfo = selectedAgents[i]
        if (!agentInfo)
            continue

        const agent = agentManager.getAgent(agentInfo.name)

        if (!agent) {
            const errorMsg = `\n\n[错误] Agent "${agentInfo.name}" 不存在，跳过...\n\n`
            yield errorMsg
            continue
        }

        // Agent启动提示（所有情况下都显示）
        if (isMultiAgent) {
            // 多Agent模式：显示详细的切换信息
            const stepInfo = `\n\n--- Agent ${i + 1}/${selectedAgents.length}: ${agentInfo.name} (置信度: ${(agentInfo.confidence * 100).toFixed(1)}%) ---\n`
            const reasonInfo = agentInfo.task
                ? `任务分配: ${agentInfo.task}\n\n`
                : `选择原因: ${agentInfo.reason}\n\n`
            yield stepInfo
            yield reasonInfo
        }
        else {
            // 单Agent模式：简洁的启动提示
            yield `🤖 正在启动 Agent: [${agentInfo.name}]\n\n`
        }

        try {
            // 为当前 Agent 创建链式处理
            const chain = new AgentChain(agent)
            const chainOptions: any = {
                maxSteps: options.maxSteps ?? 8,
                reactVerbose: options.reactVerbose ?? false,
            }
            if (typeof options.temperature === 'number') {
                chainOptions.temperature = options.temperature
            }

            // 根据是否有具体任务分配，决定传递给Agent的消息
            let agentMessages: BaseMessage[]
            if (agentInfo.task && i > 0) {
                // 如果有具体任务且不是第一个Agent，创建专门的任务消息
                const taskMessage = new HumanMessage(
                    `请专门处理以下任务：${agentInfo.task}\n\n原始用户需求供参考：${getLastHumanText(messages)}`,
                )
                agentMessages = [taskMessage]
            }
            else if (agentInfo.task) {
                // 如果是第一个Agent但有具体任务，添加任务说明
                const taskContext = new SystemMessage(
                    `重要指示：你的专门任务是：${agentInfo.task}。\n\n请注意：\n1. 只处理上述指定的任务\n2. 不要处理其他不相关的内容\n3. 其他任务将由专门的Agent处理\n4. 保持专业性和高效性`,
                )
                agentMessages = [taskContext, ...currentMessages]
            }
            else {
                // 没有具体任务分配，使用当前消息
                agentMessages = currentMessages
            }

            // 执行当前 Agent 并收集输出
            let agentOutput = ''
            const stream = chain.runChain(agentMessages, chainOptions)

            for await (const chunk of stream) {
                agentOutput += chunk
                yield chunk
            }

            // 多Agent模式：将当前 Agent 的输出作为下一个 Agent 的参考上下文
            if (isMultiAgent && i < selectedAgents.length - 1 && agentOutput.trim()) {
                // 为下一个 Agent 准备上下文
                const nextAgentInfo = selectedAgents[i + 1]

                let contextMessage: any
                if (nextAgentInfo?.task) {
                    // 如果下一个 Agent 有具体任务，明确告诉它前面已完成的工作和自己的职责
                    contextMessage = new SystemMessage(
                        `前面的 Agent 已经完成了以下工作：\n${agentOutput.trim()}\n\n重要提示：\n1. 前面的工作已经完全处理完毕，请不要重复\n2. 你的专门任务是：${nextAgentInfo.task}\n3. 请专注于你的任务，不要处理其他内容\n4. 如果你的任务在前面已经被处理过，请简单确认即可，不要重复执行`,
                    )
                }
                else {
                    // 如果下一个 Agent 没有具体任务，提供一般性上下文
                    contextMessage = new SystemMessage(
                        `前面的 Agent "${agentInfo.name}" 已完成部分工作：\n\n${agentOutput.trim()}\n\n请在此基础上继续处理用户的原始需求，但不要重复已完成的工作。`,
                    )
                }

                currentMessages = [...messages, contextMessage]
            }
        }
        catch (error) {
            const errorMsg = `\n\n[错误] Agent "${agentInfo.name}" 执行失败: ${error}\n\n`
            yield errorMsg
            logger.error(`Agent "${agentInfo.name}" 执行失败`, error)
        }
    }

    // 多Agent模式才显示完成信息
    if (isMultiAgent) {
        yield `\n\n--- 所有 Agent 执行完成 ---\n`
    }
}
