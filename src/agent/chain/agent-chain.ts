import type { BaseMessage } from '@langchain/core/messages'
import type { Agent } from '../agent.js'
import type { ChainContext, ChainOptions, ChainStep } from './types.js'
import { createLogger } from '../utils/logger.js'
import {
    DirectLLMStep,
    IntentAnalysisStep,
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
            new IntentAnalysisStep(), // 意图分析
            new DirectLLMStep(), // 直接LLM
            new ReActExecutionStep(), // ReAct执行
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

        logger.info('AgentChain runChain start')

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

        // 执行意图分析
        const intentStep = this.steps[0]
        if (intentStep) {
            await intentStep.execute(context)
        }

        // 根据意图选择执行路径
        if (context.intentResult && context.intentResult.mode === 'direct') {
            const directStep = this.steps[1]
            if (directStep) {
                yield* directStep.execute(context) as AsyncIterable<string>
            }
        }
        else {
            // ReAct模式：执行ReAct + 增强回复
            const reactStep = this.steps[2]
            const enhanceStep = this.steps[3]
            if (reactStep) {
                yield* reactStep.execute(context) as AsyncIterable<string>
            }
            if (enhanceStep) {
                yield* enhanceStep.execute(context) as AsyncIterable<string>
            }
        }
    }
}
