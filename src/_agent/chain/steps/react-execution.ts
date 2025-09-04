import type { ChainContext, ChainStep } from '../types.js'
import { createLogger } from '../../utils/logger.js'
import { PromptReActExecutor } from '../executors/index.js'

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
        // 创建执行器
        const exec = executor.run(context.messages, runOptions)
        // 消费执行器
        for await (const step of exec) {
            reactResults.push(step)

            // 解析step以检查是否包含工具调用信息
            try {
                const parsedStep = JSON.parse(step)

                if (context.options.reactVerbose) {
                    // verbose模式：展示详细信息，但移除thought字段
                    const simplifiedStep = { ...parsedStep }
                    delete simplifiedStep.thought // 移除思考过程
                    yield `${JSON.stringify(simplifiedStep)}\n`
                }
                // 非verbose模式：完全屏蔽JSON格式，不输出任何ReAct步骤内容
                // 只依赖react-executor.ts中直接输出的工具调用提示
            }
            catch {
                // 如果JSON解析失败，按照原有逻辑处理
                if (context.options.reactVerbose) {
                    yield `${step}\n`
                }
            }
        }

        context.reactResults = reactResults
    }
}
