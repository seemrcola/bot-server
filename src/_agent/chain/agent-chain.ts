import type { BaseMessage } from '@langchain/core/messages'
import type { Agent } from '../agent.js'
import type { ChainContext, ChainOptions, ChainStep } from './types.js'
import { createLogger } from '../utils/logger.js'
import { REACT_ACTION_TYPE } from './prompt/react.prompt.js'
import {
    ReActExecutionStep,
    ResponseEnhancementStep,
} from './steps/index.js'

const logger = createLogger('AgentChain')

/**
 * 主链式处理器
 */
export class AgentChain {
    private agent: Agent
    private steps: ChainStep[]

    constructor(agent: Agent) {
        this.agent = agent
        this.steps = [
            new ReActExecutionStep(), // 统一执行入口 (ReAct)
            new ResponseEnhancementStep(), // 响应增强
        ]
    }

    /**
     * 执行完整的链式处理流程
     */
    public async* runChain(
        messages: BaseMessage[],
        options: ChainOptions = {},
    ): AsyncIterable<string> {
        // 等待Agent初始化完成
        await this.agent.ready

        logger.info('AgentChain runChain start (Unified Execution)')

        // 创建上下文
        const builtOptions: ChainOptions = {
            maxSteps: options.maxSteps ?? 8,
            reactVerbose: options.reactVerbose ?? false,
        }
        if (typeof options.temperature === 'number') {
            // 仅在明确提供时设置，避免 exactOptionalPropertyTypes 触发
            (builtOptions as any).temperature = options.temperature
        }

        const context: ChainContext = {
            messages,
            agent: this.agent,
            options: builtOptions,
        }

        const [reactStep, enhanceStep] = this.steps

        // 统一执行路径：ReAct -> 增强
        if (reactStep) {
            // 执行 ReAct 循环，它现在也负责处理“直接回答”的场景
            yield* reactStep.execute(context) as AsyncIterable<string>
        }

        // 只要 ReAct 循环产生了最终答案，就进行增强
        if (enhanceStep && hasFinalAnswer(context.reactResults)) {
            yield* enhanceStep.execute(context) as AsyncIterable<string>
        }
    }
}

function hasFinalAnswer(reactResults?: string[]): boolean {
    if (!Array.isArray(reactResults) || reactResults.length === 0)
        return false
    for (let i = reactResults.length - 1; i >= 0; i--) {
        const s = reactResults[i]
        try {
            const step = s ? JSON.parse(s) : null
            if (step && step.action === REACT_ACTION_TYPE.FINAL_ANSWER && typeof step.answer === 'string') {
                return true
            }
        }
        catch {
            continue
        }
    }
    return false
}
