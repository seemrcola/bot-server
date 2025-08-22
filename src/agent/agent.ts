import type { BaseLanguageModel } from '@langchain/core/language_models/base'
import type { ExternalServerConfig, ExternalTool } from './mcp/client/manager.js'
import { ClientManager } from './mcp/client/manager.js'
import { createLogger } from './utils/logger.js'

const logger = createLogger('Agent')

const BASE_SYSTEM_PROMPT = `
你是一个乐于助人的 AI 助手。
回复内容请使用 Markdown 格式。
`

/**
 * Agent 类是整个应用的核心，负责管理 LLM 实例、外部服务、系统提示词等。
 * @param llm - LLM 实例
 * @param externalServers - 外部服务列表
 * @param systemPrompt - 系统提示词
 */
export class Agent {
    private llm: BaseLanguageModel
    private systemPrompt: string
    private externalClientManager: ClientManager
    // 已移除 allTools 缓存，避免状态陈旧与未使用字段
    public readonly ready: Promise<void>
    private resolveReady!: () => void

    constructor(
        llm: BaseLanguageModel,
        externalServers: ExternalServerConfig[] = [],
        systemPrompt: string,
    ) {
        if (!llm)
            throw new Error('Agent 需要一个有效的 LLM 实例。')

        this.llm = llm
        this.systemPrompt = systemPrompt || BASE_SYSTEM_PROMPT
        this.externalClientManager = new ClientManager()

        logger.info('Agent 已创建。正在初始化外部服务...')

        /**
         * 创建一个promise，用于等待Agent初始化完成
         * 将resolveReady赋值给resolve，这样在别的函数中可以调用resolveReady()来通知Agent初始化完成
         * 可以使用Promise.withResolvers()来实现。 如下：
         * const { promise, resolve } = Promise.withResolvers<void>();
         * this.ready = promise;
         * this.resolveReady = resolve;
         */
        this.ready = new Promise<void>((resolve) => {
            this.resolveReady = resolve
        })

        this.initialize(externalServers)
    }

    public get languageModel(): BaseLanguageModel {
        return this.llm
    }

    public get clientManager(): ClientManager {
        return this.externalClientManager
    }

    public get systemPromptValue(): string {
        return this.systemPrompt
    }

    /**
     * 按需获取当前可用工具列表（透传自 ClientManager，避免本地缓存陈旧）。
     */
    public async listTools(): Promise<ExternalTool[]> {
        return this.externalClientManager.getAllTools()
    }

    private async initialize(externalServers: ExternalServerConfig[]) {
        try {
            // 连接外部服务 连接同时创建对应的 client 与 外部服务 一一对应
            await this.externalClientManager.connect(externalServers)
            const tools = await this.externalClientManager.getAllTools()
            logger.info('Agent 初始化完成。')
            logger.info(`发现了 ${tools.length} 个外部工具。`)
            this.resolveReady() // 通知Agent初始化完成
        }
        catch (error) {
            logger.error('Agent 初始化失败', error)
            throw error
        }
    }
}
