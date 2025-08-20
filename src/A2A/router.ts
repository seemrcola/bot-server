import type { BaseMessage } from '@langchain/core/messages'
import type { AgentManager } from './manager.js'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('LLMAgentRouter')

export interface LLMRouteResult {
    name: string // 命中的 Agent 名称
    reason: string // 命中原因（模型给出的理由）
    confidence: number // 置信度（0~1）
}
export type LLMRouteTuple = [error: string | null, data: LLMRouteResult | null]

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
        '- 否则选择 leader-agent 作为兜底。',
    ].join('\n'))

    const human = new HumanMessage([
        '用户最后一条消息：',
        JSON.stringify(userText),
        '\n\n候选子 Agent 列表：',
        JSON.stringify(catalog, null, 2),
        '\n\nLeader 名称：',
        leaderName,
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
