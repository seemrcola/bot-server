/**
 * API通信模块
 * 负责与Bot Server后端的所有网络通信
 */

import { API_ENDPOINTS, DEFAULT_CONFIG, ERROR_MESSAGES } from '../utils/constants.js'

class APIClient {
    constructor(baseUrl = DEFAULT_CONFIG.BASE_URL) {
        this.baseUrl = baseUrl.replace(/\/$/, '')
        this.timeout = DEFAULT_CONFIG.TIMEOUT
        this.maxRetries = DEFAULT_CONFIG.MAX_RETRIES
    }

    /**
     * 设置基础URL
     * @param {string} url - 基础URL
     */
    setBaseUrl(url) {
        this.baseUrl = url.replace(/\/$/, '')
    }

    /**
     * 获取完整URL
     * @param {string} endpoint - API端点
     * @returns {string}
     */
    getUrl(endpoint) {
        return `${this.baseUrl}${endpoint}`
    }

    /**
     * 创建带超时的fetch请求
     * @param {string} url - 请求URL
     * @param {object} options - 请求选项
     * @returns {Promise}
     */
    async fetchWithTimeout(url, options = {}) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeout)

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            })
            clearTimeout(timeoutId)
            return response
        }
        catch (error) {
            clearTimeout(timeoutId)
            if (error.name === 'AbortError') {
                throw new Error(ERROR_MESSAGES.TIMEOUT_ERROR)
            }
            throw error
        }
    }

    /**
     * 重试机制包装器
     * @param {Function} operation - 要重试的操作
     * @param {number} retries - 重试次数
     * @returns {Promise}
     */
    async withRetry(operation, retries = this.maxRetries) {
        let lastError

        for (let i = 0; i <= retries; i++) {
            try {
                return await operation()
            }
            catch (error) {
                lastError = error

                // 如果是最后一次尝试，直接抛出错误
                if (i === retries) {
                    break
                }

                // 某些错误不需要重试
                if (error.status === 404 || error.status === 401 || error.status === 403) {
                    break
                }

                // 等待一段时间后重试（指数退避）
                const delay = 2 ** i * 1000
                await new Promise(resolve => setTimeout(resolve, delay))

                console.warn(`请求失败，${delay}ms后进行第${i + 1}次重试...`)
            }
        }

        throw lastError
    }

    /**
     * 发起流式聊天请求
     * @param {Array} messages - 消息历史
     * @param {object} options - 请求选项
     * @returns {AsyncGenerator}
     */
    async* streamChat(messages, options = {}) {
        const url = this.getUrl(API_ENDPOINTS.CHAT_STREAM)
        const requestBody = {
            messages,
            reactVerbose: options.reactVerbose ?? DEFAULT_CONFIG.REACT_VERBOSE,
            ...options,
        }

        try {
            const response = await this.withRetry(async () => {
                const res = await this.fetchWithTimeout(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                })

                if (!res.ok) {
                    const error = new Error(`HTTP ${res.status}: ${res.statusText}`)
                    error.status = res.status
                    throw error
                }

                return res
            })

            if (!response.body) {
                throw new Error('响应体为空')
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()

            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done)
                        break

                    const chunk = decoder.decode(value)
                    const lines = chunk.split('\n').filter(Boolean)

                    for (const line of lines) {
                        yield {
                            type: 'chunk',
                            data: line,
                            timestamp: Date.now(),
                        }
                    }
                }
            }
            finally {
                reader.releaseLock()
            }
        }
        catch (error) {
            console.error('流式聊天请求失败:', error)

            // 根据错误类型提供友好的错误信息
            let errorMessage
            if (error.message.includes('Failed to fetch')) {
                errorMessage = ERROR_MESSAGES.NETWORK_ERROR
            }
            else if (error.message.includes('timeout')) {
                errorMessage = ERROR_MESSAGES.TIMEOUT_ERROR
            }
            else if (error.status >= 500) {
                errorMessage = ERROR_MESSAGES.SERVER_ERROR
            }
            else {
                errorMessage = error.message || ERROR_MESSAGES.UNKNOWN_ERROR
            }

            yield {
                type: 'error',
                error: errorMessage,
                originalError: error,
                timestamp: Date.now(),
            }
        }
    }

    /**
     * 获取Agent列表
     * @returns {Promise<object>}
     */
    async getAgents() {
        const url = this.getUrl(API_ENDPOINTS.LIST_AGENTS)

        return this.withRetry(async () => {
            const response = await this.fetchWithTimeout(url)

            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
                error.status = response.status
                throw error
            }

            return response.json()
        })
    }

    /**
     * 获取工具列表
     * @returns {Promise<object>}
     */
    async getTools() {
        const url = this.getUrl(API_ENDPOINTS.LIST_TOOLS)

        return this.withRetry(async () => {
            const response = await this.fetchWithTimeout(url)

            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
                error.status = response.status
                throw error
            }

            return response.json()
        })
    }

    /**
     * 健康检查
     * @returns {Promise<object>}
     */
    async healthCheck() {
        const url = this.getUrl(API_ENDPOINTS.HEALTH)

        return this.withRetry(async () => {
            const response = await this.fetchWithTimeout(url)

            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
                error.status = response.status
                throw error
            }

            return response.json()
        })
    }

    /**
     * 测试连接
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        try {
            await this.healthCheck()
            return true
        }
        catch (error) {
            console.error('连接测试失败:', error)
            return false
        }
    }

    /**
     * 获取服务器信息
     * @returns {Promise<object>}
     */
    async getServerInfo() {
        try {
            const [health, agents, tools] = await Promise.allSettled([
                this.healthCheck(),
                this.getAgents(),
                this.getTools(),
            ])

            return {
                health: health.status === 'fulfilled' ? health.value : null,
                agents: agents.status === 'fulfilled' ? agents.value : null,
                tools: tools.status === 'fulfilled' ? tools.value : null,
                connected: health.status === 'fulfilled',
            }
        }
        catch (error) {
            console.error('获取服务器信息失败:', error)
            return {
                health: null,
                agents: null,
                tools: null,
                connected: false,
                error: error.message,
            }
        }
    }
}

// 创建默认实例
const defaultClient = new APIClient()

/**
 * 高级API接口
 */
const api = {
    /**
     * 发送消息（流式）
     * @param {object} params - 参数
     * @param {string} params.message - 消息内容
     * @param {Array} params.history - 历史消息
     * @param {string} params.baseUrl - 基础URL
     * @param {object} callbacks - 回调函数
     */
    async sendMessage(params, callbacks = {}) {
        const { message, history = [], baseUrl } = params
        const { onChunk, onComplete, onError } = callbacks

        // 更新客户端URL
        if (baseUrl) {
            defaultClient.setBaseUrl(baseUrl)
        }

        // 构建消息数组 - 转换为LangChain格式
        const messages = [
            ...history.map(msg => ({
                type: msg.role === 'user' ? 'human' : 'ai',
                content: msg.content,
            })),
            {
                type: 'human',
                content: message,
            },
        ]

        try {
            for await (const chunk of defaultClient.streamChat(messages)) {
                if (chunk.type === 'chunk' && onChunk) {
                    onChunk(chunk.data)
                }
                else if (chunk.type === 'error' && onError) {
                    onError(new Error(chunk.error))
                    return
                }
            }

            if (onComplete) {
                onComplete()
            }
        }
        catch (error) {
            if (onError) {
                onError(error)
            }
            else {
                throw error
            }
        }
    },

    /**
     * 获取Agent列表
     * @param {string} baseUrl - 基础URL
     * @returns {Promise<object>}
     */
    async listAgents(baseUrl) {
        if (baseUrl) {
            defaultClient.setBaseUrl(baseUrl)
        }
        return defaultClient.getAgents()
    },

    /**
     * 获取工具列表
     * @param {string} baseUrl - 基础URL
     * @returns {Promise<object>}
     */
    async listTools(baseUrl) {
        if (baseUrl) {
            defaultClient.setBaseUrl(baseUrl)
        }
        return defaultClient.getTools()
    },

    /**
     * 健康检查
     * @param {string} baseUrl - 基础URL
     * @returns {Promise<object>}
     */
    async healthCheck(baseUrl) {
        if (baseUrl) {
            defaultClient.setBaseUrl(baseUrl)
        }
        return defaultClient.healthCheck()
    },

    /**
     * 测试连接
     * @param {string} baseUrl - 基础URL
     * @returns {Promise<boolean>}
     */
    async testConnection(baseUrl) {
        if (baseUrl) {
            defaultClient.setBaseUrl(baseUrl)
        }
        return defaultClient.testConnection()
    },

    /**
     * 获取服务器信息
     * @param {string} baseUrl - 基础URL
     * @returns {Promise<object>}
     */
    async getServerInfo(baseUrl) {
        if (baseUrl) {
            defaultClient.setBaseUrl(baseUrl)
        }
        return defaultClient.getServerInfo()
    },

    /**
     * 获取原始客户端实例
     * @returns {APIClient}
     */
    getClient() {
        return defaultClient
    },
}

export default api
