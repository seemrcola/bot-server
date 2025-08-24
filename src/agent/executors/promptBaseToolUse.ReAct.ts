import type { BaseLanguageModel } from '@langchain/core/language_models/base'
import type { BaseMessage } from '@langchain/core/messages'
import type { Agent } from '../agent.js'
import type { ClientManager } from '../mcp/client/manager.js'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createLogger } from '../utils/logger.js'
import { extractDisplayableTextFromToolResult, extractText } from './utils.js'

const logger = createLogger('ReActExecutor')
const MAX_STEPS = 8

export type ReActActionType = 'tool_call' | 'final_answer'

export interface ReActStep {
    thought: string
    action: ReActActionType
    action_input?: {
        tool_name?: string
        parameters?: Record<string, unknown>
    }
    observation?: string
    answer?: string
}

export interface ReActExecutorOptions {
    maxSteps?: number
    temperature?: number
}

export class PromptReActExecutor {
    private readonly llm: BaseLanguageModel
    private readonly clientManager: ClientManager
    private readonly systemPrompt: string
    private readonly agent: Agent

    constructor(params: { agent: Agent }) {
        this.agent = params.agent
        this.llm = this.agent.languageModel
        this.clientManager = this.agent.clientManager
        this.systemPrompt = this.agent.systemPromptValue
    }

    public async* run(
        messages: BaseMessage[],
        options: ReActExecutorOptions = {},
    ): AsyncIterable<string> {
        const maxSteps = options.maxSteps ?? MAX_STEPS

        const userMessage = messages[messages.length - 1]
        if (!userMessage) {
            yield JSON.stringify({ error: '未收到任何消息。' })
            return
        }

        const availableTools = await this.clientManager.getAllTools()

        const toolCatalog = availableTools.map(t => ({
            name: t.name,
            description: t.annotations?.title ?? '',
            inputSchema: t.inputSchema ?? {},
        }))

        const steps: ReActStep[] = []

        for (let i = 0; i < maxSteps; i++) {
            const promptMessages: BaseMessage[] = [
                new SystemMessage(
                    [
                        this.systemPrompt,
                        '你正在以 ReAct 模式进行推理与工具使用。',
                        '严格以 JSON 输出（不可包含多余说明、不可使用 Markdown 代码块）。',
                        'JSON 结构如下：',
                        '{',
                        '  "thought": "当前推理步骤的逻辑说明",',
                        '  "action": "下一步动作类型（如：tool_call, final_answer）",',
                        '  "action_input": {',
                        '    "tool_name": "工具名（若action为tool_call）",',
                        '    "parameters": {}',
                        '  },',
                        '  "observation": "上一步工具调用的返回结果（仅后续步骤需要）",',
                        '  "answer": "最终回答（若action为final_answer)"',
                        '}',
                        '输出要求：',
                        '- 只能输出一个 JSON 对象；',
                        '- 当 action 为 tool_call 时，必须给出 action_input.tool_name 和 action_input.parameters；',
                        '- 当 action 为 final_answer 时，必须给出 answer；',
                        '- 仅当必要工具已调用且信息充分时，才可输出 final_answer。',
                    ].join('\n'),
                ),
                new HumanMessage(
                    [
                        '任务: ',
                        stringifySafe(userMessage),
                        '\n\n可用工具(仅名称/描述/输入Schema)：',
                        JSON.stringify(toolCatalog, null, 2),
                        '\n\n历史步骤(如有)：',
                        JSON.stringify(steps, null, 2),
                        '\n\n请给出下一步的 JSON 决策：',
                    ].join(''),
                ),
            ]

            let raw: any
            try {
                /**
                 * 根据传入的温度，尝试对模型进行参数绑定
                 */
                const baseModel: any = this.llm as any
                const llmToUse: any = (typeof baseModel?.bind === 'function' && typeof options.temperature === 'number')
                    ? baseModel.bind({ temperature: options.temperature })
                    : baseModel
                raw = await llmToUse.invoke(promptMessages)
            }
            catch (err) {
                const errMsg = `LLM 调用失败: ${err instanceof Error ? err.message : String(err)}`
                logger.error(errMsg, err)
                yield JSON.stringify({ error: errMsg })
                return
            }

            const content = extractText(raw?.content)
            const parsed = tryParseJson(content)
            if (!parsed.ok) {
                const step: ReActStep = {
                    thought: '解析模型输出失败，准备终止。',
                    action: 'final_answer',
                    answer: `对不起，决策解析失败：${parsed.error}`,
                }
                steps.push(step)
                yield JSON.stringify(step)
                return
            }

            const step = normalizeStep(parsed.value)
            steps.push(step)
            yield JSON.stringify(step)

            if (step.action === 'final_answer') {
                return
            }

            if (step.action === 'tool_call') {
                const toolName = step.action_input?.tool_name
                const parameters = { ...(step.action_input?.parameters ?? {}) } as Record<string, unknown>
                if (!toolName) {
                    const obs = '缺少 tool_name，无法调用工具。'
                    const lastStep = steps[steps.length - 1]!
                    lastStep.observation = obs
                    yield JSON.stringify(lastStep)
                    continue
                }

                try {
                    const result = await this.clientManager.callTool(toolName, parameters)
                    const observation = extractDisplayableTextFromToolResult(result)
                    const lastStep = steps[steps.length - 1]!
                    lastStep.observation = observation
                    yield JSON.stringify(lastStep)
                }
                catch (err) {
                    const observation = `工具调用失败: ${err instanceof Error ? err.message : String(err)}`
                    const lastStep = steps[steps.length - 1]!
                    lastStep.observation = observation
                    yield JSON.stringify(lastStep)
                }
            }
        }

        // 达到步数上限
        const fallback: ReActStep = {
            thought: '达到最大推理步数，返回当前最优答案。',
            action: 'final_answer',
            answer: steps[steps.length - 1]?.observation || '未能在限定步数内得到明确答案。',
        }
        yield JSON.stringify(fallback)
    }
}

function tryParseJson(text: string): { ok: true, value: any } | { ok: false, error: string } {
    try {
    // 尝试提取第一个 JSON 对象
        const start = text.indexOf('{')
        const end = text.lastIndexOf('}')
        const slice = start >= 0 && end >= start ? text.slice(start, end + 1) : text
        return { ok: true, value: JSON.parse(slice) }
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
}

function normalizeStep(obj: any): ReActStep {
    const step: ReActStep = {
        thought: typeof obj?.thought === 'string' ? obj.thought : '',
        action: (obj?.action as ReActActionType) ?? 'final_answer',
        observation: typeof obj?.observation === 'string' ? obj.observation : undefined,
        answer: typeof obj?.answer === 'string' ? obj.answer : undefined,
    }
    if (obj?.action_input && typeof obj.action_input === 'object') {
        step.action_input = {
            tool_name: obj?.action_input?.tool_name,
            parameters: (obj?.action_input?.parameters && typeof obj.action_input.parameters === 'object') ? obj.action_input.parameters : {},
        }
    }
    return step
}

function stringifySafe(message: BaseMessage): string {
    try {
        return JSON.stringify({
            type: (message as any)?.getType?.(),
            content: (message as any)?.content ?? '',
        })
    }
    catch {
        return String((message as any)?.content ?? '')
    }
}
