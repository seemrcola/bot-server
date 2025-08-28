import type { BaseMessage } from '@langchain/core/messages'
import type { AgentManager } from './manager.js'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createLogger } from '@/utils/logger.js'
import {
    AGENT_LIMITS,
    ROUTING_CONFIDENCE,
    ROUTING_ERRORS,
} from './constants/index.js'

const logger = createLogger('LLMAgentRouter')

export interface LLMRouteResult {
    name: string // 命中的 Agent 名称
    reason: string // 命中原因（模型给出的理由）
    confidence: number // 置信度（0~1）
    task?: string // 该Agent的具体任务描述（可选）
}

export interface LLMMultiRouteResult {
    agents: LLMRouteResult[] // 匹配的多个 Agent
    totalMatches: number // 总匹配数量
}

export type LLMMultiRouteTuple = [error: string | null, data: LLMMultiRouteResult | null]

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

/**
 * 使用 LLM 进行多 Agent 路由：分析用户需求，返回多个可能匹配的 Agent
 * 注意：单Agent只是多Agent的特殊情况（N=1），统一使用此函数进行路由
 * @param params - 路由参数
 * @param params.agentManager - AgentManager 实例
 * @param params.messages - 用户消息
 * @param params.threshold - 置信度阈值，默认值来自 ROUTING_CONFIDENCE.MULTI_AGENT_THRESHOLD
 * @param params.maxAgents - 最大返回agent数量，默认值来自 AGENT_LIMITS.MULTI_ROUTE_MAX_AGENTS
 * @returns 多agent路由结果（可能是0个、1个或多个Agent）
 */
export async function selectMultipleAgentsByLLM(params: {
    agentManager: AgentManager
    messages: BaseMessage[]
    threshold?: number
    maxAgents?: number
}): Promise<LLMMultiRouteTuple> {
    const { agentManager } = params
    const threshold = typeof params.threshold === 'number' ? params.threshold : ROUTING_CONFIDENCE.MULTI_AGENT_THRESHOLD
    const maxAgents = typeof params.maxAgents === 'number' ? params.maxAgents : AGENT_LIMITS.MULTI_ROUTE_MAX_AGENTS

    const leaderName = agentManager.getLeaderName()
    const leader = agentManager.getLeader()
    if (!leader || !leaderName) {
        const err = `${ROUTING_ERRORS.NO_LEADER}: 未找到可用的 Leader Agent`
        return [err, null]
    }

    // 收集候选子 Agent 列表
    const subs = agentManager.listSubAgents(leaderName)
    const catalog = subs.map(s => ({
        name: s.name,
        description: s.description || '',
        keywords: s.meta?.keywords || [],
        aliases: s.meta?.aliases || [],
    }))

    const userText = getLastHumanText(params.messages)

    const sys = new SystemMessage([
        '你是一个智能任务分解器和路由器。你的职责：',
        '1. 分析用户的需求，判断是否需要专业Agent处理',
        '2. 如果需要，为每个子任务选择最合适的专业Agent',
        '3. 为每个Agent指定明确的任务范围，避免重复工作',
        '',
        '重要原则：',
        '- 对于通用问题（如问候、闲聊、基本问答），必须返回空数组 []',
        '- 只有当用户明确需要特定领域的专业服务时，才选择相应的Agent',
        '- 每个Agent只处理自己专长领域的任务',
        '- 不同的Agent不应重复执行相同类型的工作',
        '- 按逻辑顺序安排Agent执行',
        '',
        '输出格式（JSON数组）：',
        '对于通用问题：[]',
        '对于专业需求：',
        '[',
        '  {',
        '    "target": "agent-name",',
        '    "task": "该Agent的具体任务描述",',
        '    "reason": "选择该Agent的原因",',
        '    "confidence": 0.0到1.0之间的数值',
        '  }',
        ']',
    ].join('\n'))

    const human = new HumanMessage([
        '用户原始需求：',
        JSON.stringify(userText),
        '\n\n可用的专业 Agent 列表：',
        JSON.stringify(catalog, null, 2),
        '\n\n请分析用户需求：',
        '1. 这是否为通用问题（问候、闲聊等）？如果是，返回 []',
        '2. 如果需要专业服务，识别其中包含的不同类型子任务',
        '3. 为每个子任务选择最合适的Agent',
        '4. 明确每个Agent的具体职责范围',
        '\n返回JSON数组：',
    ].join(''))

    let raw: any
    try {
        raw = await leader.languageModel.invoke([sys, human])
    }
    catch (e) {
        logger.warn('LLM 多路由调用失败', e)
        return [ROUTING_ERRORS.INVOKE_ERROR, null]
    }

    const text = String((raw as any)?.content ?? '').trim()
    try {
        // 解析 JSON 结果
        const start = text.indexOf('[')
        const end = text.lastIndexOf(']')
        const slice = start >= 0 && end >= start ? text.slice(start, end + 1) : text

        const results = JSON.parse(slice) as Array<{
            target?: string
            task?: string
            reason?: string
            confidence?: number
            order?: number
        }>

        if (!Array.isArray(results)) {
            return [`${ROUTING_ERRORS.INVALID_FORMAT}: 期望返回数组格式`, null]
        }

        // 处理和验证结果
        const validAgents: LLMRouteResult[] = []

        for (const result of results) {
            const target = (result.target || '').trim()
            const task = typeof result.task === 'string' ? result.task.trim() : ''
            const reason = typeof result.reason === 'string' ? result.reason : ''
            const confidence = typeof result.confidence === 'number' ? result.confidence : 0

            // 检查基本有效性
            if (!target)
                continue

            // 检查agent是否存在
            if (!agentManager.getAgent(target)) {
                logger.warn(`路由结果中的Agent [${target}] 不存在`)
                continue
            }

            // 检查置信度
            if (confidence < threshold) {
                logger.debug(`Agent [${target}] 置信度 ${confidence} 低于阈值 ${threshold}`)
                continue
            }

            const routeResult: LLMRouteResult = {
                name: target,
                reason: reason || 'llm_multi_route',
                confidence,
            }

            // 只在有具体任务时才添加task字段
            if (task) {
                routeResult.task = task
            }

            validAgents.push(routeResult)
        }

        // 按置信度排序（高到低）
        validAgents.sort((a, b) => b.confidence - a.confidence)

        // 限制返回数量
        const finalAgents = validAgents.slice(0, maxAgents)

        // 允许返回空数组，让调用方决定如何处理（比如回退到Leader）
        return [null, {
            agents: finalAgents,
            totalMatches: finalAgents.length,
        }]
    }
    catch (e) {
        logger.warn('LLM 多路由结果解析失败', e)
        return [ROUTING_ERRORS.PARSE_ERROR, null]
    }
}
