import type { BaseMessage } from '@langchain/core/messages'
import type { AgentManager } from './manager.js'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createLogger } from '@/utils/logger.js'

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

export type LLMRouteTuple = [error: string | null, data: LLMRouteResult | null]
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
 * 使用 LLM 进行“精准路由”：在已注册的子 Agent 与 Leader 之间选择最合适的 Agent。
 * @param params - 路由参数
 * @param params.agentManager - AgentManager 实例
 * @param params.messages - 用户消息
 * @param params.threshold - 置信度阈值，默认0.5
 * @returns 路由结果
 * 返回 [error, data]：
 *  - 命中： [null, { name, reason, confidence }]
 *  - 失败： [string, null]，不做任何兜底（由 orchestrator 负责回退）
 */
export async function selectAgentByLLM(params: {
    agentManager: AgentManager // AgentManager 实例
    messages: BaseMessage[] // 用户消息
    threshold?: number // 置信度阈值，默认0.5
}): Promise<LLMRouteTuple> {
    const { agentManager } = params
    const threshold
    = typeof params.threshold === 'number'
        ? params.threshold
        : 0.5

    const leaderName = agentManager.getLeaderName()
    const leader = agentManager.getLeader()
    if (!leader || !leaderName) {
        const err = 'no_leader: 未找到可用的 Leader Agent'
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
        '你是一个路由器。你的任务：根据用户的最后一条需求文本，在候选 Agent 中选择最合适的一个来处理。',
        '候选列表包含名称、简介、关键词、别名。',
        '必须只输出一个 JSON 对象，不要额外文本或代码块。',
        '{',
        '  "target": "agent-name 或者 空字符串",',
        '  "reason": "简述选择原因",',
        '  "confidence": 0.0 到 1.0 之间的数值',
        '}',
        '选择规则：',
        '- 若用户需求与某个子 Agent 的名称/关键词/别名强相关，则选该子 Agent；',
        '- 若不确定或均不合适，请将 target 置为空字符串。',
    ].join('\n'))

    const human = new HumanMessage([
        '用户最后一条消息：',
        JSON.stringify(userText),
        '\n\n候选子 Agent 列表：',
        JSON.stringify(catalog, null, 2),
        '\n\n请输出 JSON：',
    ].join(''))

    let raw: any
    try {
        raw = await leader.languageModel.invoke([sys, human])
    }
    catch (e) {
        logger.warn('LLM 路由调用失败', e)
        return ['invoke_error', null]
    }

    const text = String((raw as any)?.content ?? '').trim()
    try {
        // 解析 JSON 结果
        const start = text.indexOf('{')
        const end = text.lastIndexOf('}')
        const slice = start >= 0 && end >= start ? text.slice(start, end + 1) : text
        // 解析 JSON 对象
        const obj = JSON.parse(slice) as { target?: string, reason?: string, confidence?: number }
        // 提取目标 Agent 名称、原因、置信度
        const target = (obj.target || '').trim()
        const reason = typeof obj.reason === 'string' ? obj.reason : ''
        const confidence = typeof obj.confidence === 'number' ? obj.confidence : 0

        // 置信度检查与存在性检查
        // 如果target为空，则回退
        if (!target) {
            return ['empty_target', null]
        }
        // 检查target是否存在
        // target在subAgents中存在 此时targetExists为true
        const targetExists = !!agentManager.getAgent(target)
        // 如果target不存在或者置信度小于阈值，则回退
        if (!targetExists) {
            return ['target_not_found', null]
        }
        if (confidence < threshold) {
            return ['low_confidence', null]
        }
        // 命中
        return [null, { name: target, reason: reason || 'llm', confidence }]
    }
    catch (e) {
        logger.warn('LLM 路由结果解析失败', e)
        return ['parse_error', null]
    }
}

/**
 * 使用 LLM 进行多 Agent 路由：分析用户需求，返回多个可能匹配的 Agent
 * @param params - 路由参数
 * @param params.agentManager - AgentManager 实例
 * @param params.messages - 用户消息
 * @param params.threshold - 置信度阈值，默认0.3（比单agent路由稍低）
 * @param params.maxAgents - 最大返回agent数量，默认3
 * @returns 多agent路由结果
 */
export async function selectMultipleAgentsByLLM(params: {
    agentManager: AgentManager
    messages: BaseMessage[]
    threshold?: number
    maxAgents?: number
}): Promise<LLMMultiRouteTuple> {
    const { agentManager } = params
    const threshold = typeof params.threshold === 'number' ? params.threshold : 0.3
    const maxAgents = typeof params.maxAgents === 'number' ? params.maxAgents : 3

    const leaderName = agentManager.getLeaderName()
    const leader = agentManager.getLeader()
    if (!leader || !leaderName) {
        const err = 'no_leader: 未找到可用的 Leader Agent'
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
        '1. 分析用户的复合需求，识别其中包含的不同类型子任务',
        '2. 为每个子任务选择最合适的专业Agent',
        '3. 为每个Agent指定明确的任务范围，避免重复工作',
        '',
        '重要原则：',
        '- 每个Agent只处理自己专长领域的任务',
        '- 不同Agent不应重复执行相同类型的工作',
        '- 按逻辑顺序安排Agent执行',
        '- 只有真正需要多个Agent时才返回多个',
        '',
        '输出格式（JSON数组）：',
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
        '1. 识别其中包含的不同类型子任务',
        '2. 为每个子任务选择最合适的Agent',
        '3. 明确每个Agent的具体职责范围',
        '\n返回JSON数组：',
    ].join(''))

    let raw: any
    try {
        raw = await leader.languageModel.invoke([sys, human])
    }
    catch (e) {
        logger.warn('LLM 多路由调用失败', e)
        return ['invoke_error', null]
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
            return ['invalid_format: 期望返回数组格式', null]
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

        if (finalAgents.length === 0) {
            return ['no_valid_agents', null]
        }

        return [null, {
            agents: finalAgents,
            totalMatches: finalAgents.length,
        }]
    }
    catch (e) {
        logger.warn('LLM 多路由结果解析失败', e)
        return ['parse_error', null]
    }
}
