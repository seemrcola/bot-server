import type { BaseMessage } from '@langchain/core/messages'
import type { ChainContext, ChainStep } from '../types.js'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createLogger } from '../../utils/logger.js'
import { extractJsonFromText, extractText } from '../executors/index.js'

const logger = createLogger('IntentAnalysisStep')

/**
 * 意图分析步骤
 */
export class IntentAnalysisStep implements ChainStep {
    name = 'intent_analysis'

    async execute(context: ChainContext): Promise<void> {
        logger.info('开始意图分析')

        // 获取工具目录
        const toolCatalog = await context.agent.listToolCatalog()
        console.log('工具目录：', toolCatalog)

        const intentMessages: BaseMessage[] = [
            new SystemMessage([
                context.agent.systemPromptValue,
                '你是意图分析器。任务：基于完整对话上下文，判断用户是否需要使用外部工具才能得到高质量答案。',
                '仅输出一个 JSON 对象，不要额外文本或代码块。',
                '{',
                '  "use_tools": true | false,',
                '  "reason": "简要说明判断依据"',
                '}',
                '判断依据：',
                '- 基于完整对话历史理解用户真实意图；',
                '- 当与我们所提供的工具目录存在吻合度较高的描述时，请认为需要工具；',
                // '- 当用户说"再查一次"、"重新查询"等时，应理解为需要重新调用相关工具；',
                '- 当与工具目录描述不存在较高吻合度时，请认为不需要工具。',
            ].join('\n')),
            new HumanMessage([
                '完整对话历史：',
                JSON.stringify(context.messages),
                '\n\n可用工具列表：',
                JSON.stringify(toolCatalog),
                '\n\n请基于以上完整对话上下文输出判断 JSON：',
            ].join('')),
        ]

        try {
            const result = await context.agent.languageModel.invoke(intentMessages)
            const text = extractText(result?.content)

            // 使用通用JSON解析工具函数
            const parseResult = extractJsonFromText(text)

            if (!parseResult.success) {
                throw new Error(`JSON解析失败: ${parseResult.error}`)
            }

            const parsed = parseResult.data
            context.intentResult = {
                mode: parsed?.use_tools ? 'react' : 'direct',
                reason: parsed?.reason || '未提供原因',
            }

            logger.info(`意图分析结果：${context.intentResult.mode}模式 - ${context.intentResult.reason}`)
        }
        catch (error) {
            logger.warn('意图分析失败，回退到直接回答模式', error)
            context.intentResult = { mode: 'direct', reason: '意图分析失败，回退到直接回答' }
        }
    }
}
