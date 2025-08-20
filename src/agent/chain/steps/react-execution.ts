import type { ChainContext, ChainStep } from '../types.js'
import { PromptReActExecutor } from '../../executors/promptBaseToolUse.ReAct.js'
import { createLogger } from '../../utils/logger.js'

const logger = createLogger('ReActExecutionStep')

/**
 * ReAct执行步骤
 */
export class ReActExecutionStep implements ChainStep {
    name = 'react_execution'

    async* execute(context: ChainContext): AsyncIterable<string> {
        logger.info('执行ReAct工具调用模式')

        const { maxSteps = 8, temperature } = context.options
        const reactResults: string[] = []

        // 统一使用 PromptReActExecutor 策略
        logger.info('使用 PromptReActExecutor 策略')
        const executor = new PromptReActExecutor({ agent: context.agent })
        const runOptions: any = { maxSteps }
        if (typeof temperature === 'number') {
            runOptions.temperature = temperature
        }
        for await (const step of executor.run(context.messages, runOptions)) {
            reactResults.push(step)
            if (context.options.reactVerbose) {
                yield `${step}\n`
            }
        }

        context.reactResults = reactResults
    }
}
