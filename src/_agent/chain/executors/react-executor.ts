import type { BaseLanguageModel } from '@langchain/core/language_models/base'
import type { BaseMessage } from '@langchain/core/messages'
import type { Agent } from '../../agent.js'
import type { ClientManager } from '../../mcp/client/manager.js'
import type { ReActActionType } from '../prompt/react.prompt.js'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createLogger } from '../../utils/logger.js'
import {
    REACT_ACTION_TYPE,
    REACT_SYSTEM_PROMPT,
} from '../prompt/react.prompt.js'
import {
    extractDisplayableTextFromToolResult,
    extractJsonFromText,
    extractText,
} from './utils.js'

const logger = createLogger('ReActExecutor')
const MAX_STEPS = 8

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

        if (!messages || messages.length === 0) {
            yield JSON.stringify({ error: '未收到任何消息。' })
            return
        }

        // 获取工具目录
        const toolCatalog = await this.agent.listToolCatalog()
        // console.log('工具目录：', toolCatalog)

        // 用于存储推理/执行的步骤
        const steps: ReActStep[] = []

        for (let i = 0; i < maxSteps; i++) {
            const promptMessages: BaseMessage[] = [
                /**
                 * 系统提示词
                 * @see src/agent/chain/prompt/react.prompt.ts
                 */
                new SystemMessage(
                    [this.systemPrompt, REACT_SYSTEM_PROMPT.content].join('\n'),
                ),
                new HumanMessage(
                    [
                        '完整对话上下文: ',
                        JSON.stringify(messages),
                        '\n\n可用工具(仅名称/描述/输入Schema)：',
                        JSON.stringify(toolCatalog, null, 2),
                        '\n\n历史步骤(如有)：',
                        JSON.stringify(steps, null, 2),
                        '\n\n请基于以上完整对话上下文给出下一步的 JSON 决策：',
                    ].join(''),
                ),
            ]

            console.log('promptMessages: ', promptMessages)

            let raw: any
            try {
                /**
                 * 根据传入的温度，尝试对模型进行参数绑定
                 */
                const baseModel: any = this.llm as any
                const llmToUse: any = typeof baseModel?.bind === 'function'
                    && typeof options.temperature === 'number'
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
            const parseResult = extractJsonFromText(content)

            if (!parseResult.success) {
                const step: ReActStep = {
                    thought: '解析模型输出失败，准备终止。',
                    action: REACT_ACTION_TYPE.FINAL_ANSWER,
                    answer: `对不起，决策解析失败：${parseResult.error}`,
                }
                steps.push(step)
                yield JSON.stringify(step)
                return
            }

            const step = normalizeStep(parseResult.data)
            steps.push(step)
            yield JSON.stringify(step)

            if (step.action === REACT_ACTION_TYPE.FINAL_ANSWER) {
                return
            }

            if (step.action === REACT_ACTION_TYPE.TOOL_CALL) {
                const toolName = step.action_input?.tool_name
                const parameters = {
                    ...(step.action_input?.parameters ?? {}),
                } as Record<string, unknown>
                if (!toolName) {
                    const obs = '缺少 tool_name，无法调用工具。'
                    const lastStep = steps[steps.length - 1]!
                    lastStep.observation = obs
                    yield JSON.stringify(lastStep)
                    continue
                }

                // 添加工具调用开始的提示
                const toolCallNotice: ReActStep = {
                    thought: `正在调用工具: ${toolName}`,
                    action: REACT_ACTION_TYPE.TOOL_CALL,
                    action_input: {
                        tool_name: toolName,
                        parameters,
                    },
                    observation: `🔧 开始调用工具: [${toolName}]`,
                }
                yield JSON.stringify(toolCallNotice)

                try {
                    const result = await this.clientManager.callTool(
                        toolName,
                        parameters,
                    )
                    const observation = extractDisplayableTextFromToolResult(result)
                    const lastStep = steps[steps.length - 1]!
                    lastStep.observation = `✅ 工具 [${toolName}] 执行完成\n\n执行结果:\n${observation}`
                    yield JSON.stringify(lastStep)
                }
                catch (err) {
                    const observation = `❌ 工具 [${toolName}] 调用失败: ${err instanceof Error ? err.message : String(err)}`
                    const lastStep = steps[steps.length - 1]!
                    lastStep.observation = observation
                    yield JSON.stringify(lastStep)
                }
            }
        }

        // 达到步数上限
        const fallback: ReActStep = {
            thought: '达到最大推理步数，返回当前最优答案。',
            action: REACT_ACTION_TYPE.FINAL_ANSWER,
            answer:
        steps[steps.length - 1]?.observation
        || '未能在限定步数内得到明确答案。',
        }
        yield JSON.stringify(fallback)
    }
}

function normalizeStep(obj: any): ReActStep {
    const step: ReActStep = {
        thought: typeof obj?.thought === 'string' ? obj.thought : '',
        action: (obj?.action as ReActActionType) ?? REACT_ACTION_TYPE.FINAL_ANSWER,
        observation: typeof obj?.observation === 'string'
            ? obj.observation
            : undefined,
        answer: typeof obj?.answer === 'string' ? obj.answer : undefined,
    }
    if (obj?.action_input && typeof obj.action_input === 'object') {
        step.action_input = {
            tool_name: obj?.action_input?.tool_name,
            parameters: obj?.action_input?.parameters && typeof obj.action_input.parameters === 'object'
                ? obj.action_input.parameters
                : {},
        }
    }
    return step
}
