import type { BaseMessage } from '@langchain/core/messages'
import type { ChainContext, ChainStep } from '../types.js'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createLogger } from '../../utils/logger.js'
import { extractText } from '../executors/index.js'

const logger = createLogger('ResponseEnhancementStep')

/**
 * 响应增强步骤
 */
export class ResponseEnhancementStep implements ChainStep {
    name = 'response_enhancement'

    async* execute(context: ChainContext): AsyncIterable<string> {
        logger.info('开始增强回复')

        if (!context.reactResults) {
            logger.warn('没有ReAct结果可供增强')
            return
        }

        const finalAnswer = this.extractFinalAnswer(context.reactResults)
        const toolCalls = this.extractToolCalls(context.reactResults)

        const enhanceMessages: BaseMessage[] = [
            new SystemMessage([
                context.agent.systemPromptValue,
                '你是回复增强器。任务：将ReAct执行结果转换为用户友好的Markdown格式回答。',
                '要求：',
                '- 保持专业性和准确性',
                '- 使用Markdown格式',
                '- 如果涉及工具调用，可以简要提及使用的工具',
                '- 确保回答完整且易于理解',
            ].join('\n')),
            new HumanMessage([
                '原始问题：',
                JSON.stringify(context.messages[context.messages.length - 1] ? context.messages[context.messages.length - 1] : {}),
                '\n\nReAct执行结果：',
                JSON.stringify({ finalAnswer, toolCalls }),
                '\n\n请输出增强后的Markdown回答：',
            ].join('')),
        ]

        const stream = await context.agent.languageModel.stream(enhanceMessages)
        for await (const chunk of stream) {
            const piece = extractText((chunk as any)?.content)
            if (piece) {
                yield piece
            }
        }
    }

    private extractFinalAnswer(reactResults: string[]): string {
        for (let i = reactResults.length - 1; i >= 0; i--) {
            try {
                const result = reactResults[i]
                if (result) {
                    const step = JSON.parse(result)
                    if (step.action === 'final_answer' && step.answer && typeof step.answer === 'string') {
                        return step.answer
                    }
                }
            }
            catch {
                continue
            }
        }
        return '未能获取最终答案'
    }

    private extractToolCalls(reactResults: string[]): Array<{ tool: string, result: string }> {
        const toolCalls: Array<{ tool: string, result: string }> = []

        for (const result of reactResults) {
            try {
                const step = JSON.parse(result)
                if (step.action === 'tool_call' && step.action_input?.tool_name && typeof step.action_input.tool_name === 'string' && step.observation && typeof step.observation === 'string') {
                    toolCalls.push({
                        tool: step.action_input.tool_name,
                        result: step.observation,
                    })
                }
            }
            catch {
                continue
            }
        }

        return toolCalls
    }
}
