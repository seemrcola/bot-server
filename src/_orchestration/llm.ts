import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import process from 'node:process'
import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi'
import { ChatDeepSeek } from '@langchain/deepseek'
import { ENV_KEYS, LLM_CONFIG, SUPPORTED_MODELS } from './constants/index.js'

type SupportedModel = 'qwen' | 'deepseek'

export function createLLM(): BaseChatModel {
    const modelProvider = (process.env[ENV_KEYS.LLM_PROVIDER] as SupportedModel) || SUPPORTED_MODELS.QWEN
    const apiKey = process.env[ENV_KEYS.LLM_API_KEY] || ''
    const model = process.env[ENV_KEYS.LLM_MODEL] || ''

    if (!apiKey)
        throw new Error(`${ENV_KEYS.LLM_API_KEY} is not configured.`)

    const commonOptions = {
        temperature: LLM_CONFIG.DEFAULT_TEMPERATURE,
        streaming: LLM_CONFIG.STREAMING_ENABLED,
        model,
    }

    if (modelProvider === SUPPORTED_MODELS.QWEN) {
        return new ChatAlibabaTongyi({
            ...commonOptions,
            alibabaApiKey: apiKey,
        })
    }

    if (modelProvider === SUPPORTED_MODELS.DEEPSEEK) {
        return new ChatDeepSeek({
            ...commonOptions,
            apiKey,
        })
    }

    throw new Error(`Unsupported model provider: ${modelProvider}`)
}
