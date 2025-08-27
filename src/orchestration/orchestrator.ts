import type { BaseMessage } from '@langchain/core/messages'
import { AgentChain } from '../agent/index.js'
import { globals } from '../globals.js'
import { createLogger } from '../utils/logger.js'
import { selectAgentByLLM, selectMultipleAgentsByLLM } from './router.js'

// 从 router.ts 导入工具函数
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
    enableMultiAgent?: boolean | undefined // 是否启用多 Agent 模式，默认 false
    multiAgentThreshold?: number | undefined // 多Agent路由的置信度阈值，默认0.3
    maxAgents?: number | undefined // 最大Agent数量，默认3
}

/**
 * 运行编排（显式 → 多 Agent → LLM → Leader 兜底），对外唯一执行入口
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

    // 显式指定 Agent 优先级最高
    const explicit = (options.agentName ?? '').trim() // 显式指定要执行的 Agent

    if (explicit && agentManager.getAgent(explicit)) {
        // 显式指定模式：直接使用指定的 Agent
        const agent = agentManager.getAgent(explicit)!
        logger.info(`显式指定模式：使用 Agent: ${explicit}`)

        const chain = new AgentChain(agent)
        const chainOptions: any = {
            maxSteps: options.maxSteps ?? 8,
            reactVerbose: options.reactVerbose ?? false,
        }
        if (typeof options.temperature === 'number') {
            chainOptions.temperature = options.temperature
        }

        return chain.runChain(messages, chainOptions)
    }

    // 检查是否启用多 Agent 模式
    if (options.enableMultiAgent !== false) { // 默认为 false，但在某些情况下可以启用
        try {
            return await runWithMultipleAgents(messages, options)
        }
        catch (error) {
            logger.warn('多 Agent 模式失败，回退到单 Agent 模式', error)
            // 继续执行单 Agent 模式
        }
    }

    // 单 Agent 模式：使用 LLM 路由或 Leader 兜底
    let chosenName: string | undefined // 最终选定的 Agent 名称
    let reason = '' // 选择原因

    // 使用 LLM 路由
    const [err, data] = await selectAgentByLLM({ agentManager, messages })
    // 如果路由失败，则回退到 Leader Agent
    if (err) {
        chosenName = agentManager.getLeaderName()
        reason = `fallback:llm_route_failed:${err}`
        logger.warn(`LLM 路由失败，回退到 Leader Agent（原因: ${err}）`)
    }
    // 路由成功
    else {
        chosenName = data!.name
        reason = `llm:${data!.reason}|confidence:${data!.confidence}`
    }

    const agent = agentManager.getAgent(chosenName!)!
    logger.info(`单 Agent 模式：使用 Agent: ${chosenName}（原因: ${reason}）`)

    // 创建 AgentChain 实例
    const chain = new AgentChain(agent)
    const chainOptions: any = {
        maxSteps: options.maxSteps ?? 8,
        reactVerbose: options.reactVerbose ?? false,
    }
    if (typeof options.temperature === 'number') {
        chainOptions.temperature = options.temperature
    }

    // 执行链式流程
    return chain.runChain(messages, chainOptions)
}

/**
 * 多 Agent 顺序执行模式：根据 LLM 路由结果，顺序调用多个 Agent 处理用户请求
 * @param messages - 聊天消息
 * @param options - 聊天选项
 * @returns 流式聊天响应
 */
export async function runWithMultipleAgents(
    messages: BaseMessage[],
    options: OrchestratorOptions = {},
): Promise<AsyncIterable<string>> {
    const agentManager = globals.agentManager
    if (!agentManager) {
        logger.error('AgentManager 未初始化')
        throw new Error('AgentManager 尚未初始化')
    }

    const multiAgentThreshold = options.multiAgentThreshold ?? 0.3
    const maxAgents = options.maxAgents ?? 3

    // 使用多 Agent 路由
    const [err, data] = await selectMultipleAgentsByLLM({
        agentManager,
        messages,
        threshold: multiAgentThreshold,
        maxAgents,
    })

    if (err || !data || data.agents.length === 0) {
        // 回退到单 Agent 模式
        logger.warn(`多 Agent 路由失败（${err}），回退到单 Agent 模式`)
        return runWithLeader(messages, { ...options, enableMultiAgent: false })
    }

    const selectedAgents = data.agents
    logger.info(`多 Agent 模式：将顺序调用 ${selectedAgents.length} 个 Agent: ${selectedAgents.map(a => a.name).join(' -> ')}`)

    // 为多个 Agent 创建流式生成器
    return createMultiAgentStream(messages, selectedAgents, options)
}

/**
 * 创建多 Agent 流式输出生成器
 */
async function* createMultiAgentStream(
    messages: BaseMessage[],
    selectedAgents: Array<{ name: string, reason: string, confidence: number, task?: string }>,
    options: OrchestratorOptions,
): AsyncGenerator<string, void, unknown> {
    const agentManager = globals.agentManager!
    let currentMessages = [...messages]

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

        // 输出 Agent 切换信息
        const stepInfo = `\n\n--- Agent ${i + 1}/${selectedAgents.length}: ${agentInfo.name} (置信度: ${(agentInfo.confidence * 100).toFixed(1)}%) ---\n`
        const reasonInfo = agentInfo.task
            ? `任务分配: ${agentInfo.task}\n\n`
            : `选择原因: ${agentInfo.reason}\n\n`
        yield stepInfo
        yield reasonInfo

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
                const { HumanMessage: HumanMessageClass } = await import('@langchain/core/messages')
                const taskMessage = new HumanMessageClass(
                    `请专门处理以下任务：${agentInfo.task}\n\n原始用户需求供参考：${getLastHumanText(messages)}`,
                )
                agentMessages = [taskMessage]
            }
            else if (agentInfo.task) {
                // 如果是第一个Agent但有具体任务，添加任务说明
                const { SystemMessage } = await import('@langchain/core/messages')
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

            // 将当前 Agent 的输出作为下一个 Agent 的参考上下文
            if (i < selectedAgents.length - 1 && agentOutput.trim()) {
                // 为下一个 Agent 准备上下文
                const { SystemMessage } = await import('@langchain/core/messages')
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

    // 所有 Agent 执行完成
    yield `\n\n--- 所有 Agent 执行完成 ---\n`
}
