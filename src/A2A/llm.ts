import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import process from 'node:process'
import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi'
import { ChatDeepSeek } from '@langchain/deepseek'

type SupportedModel = 'qwen' | 'deepseek'

export function createLLM(): BaseChatModel {
    const modelProvider = (process.env['LLM_PROVIDER'] as SupportedModel) || 'qwen'
    const apiKey = process.env['LLM_API_KEY'] || ''
    const model = process.env['LLM_MODEL'] || ''

    if (!apiKey)
        throw new Error('LLM_API_KEY is not configured.')

    const commonOptions = {
        temperature: 0.7,
        streaming: true,
        model,
    }

    if (modelProvider === 'qwen') {
        return new ChatAlibabaTongyi({
            ...commonOptions,
            alibabaApiKey: apiKey,
        })
    }

    if (modelProvider === 'deepseek') {
        return new ChatDeepSeek({
            ...commonOptions,
            apiKey,
        })
    }

    throw new Error(`Unsupported model provider: ${modelProvider}`)
}
