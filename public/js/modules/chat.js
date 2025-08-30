/**
 * 聊天功能模块
 * 负责消息发送、接收、流式显示和ReAct步骤处理
 */

import { setHTML } from '../utils/dom.js'
import api from './api.js'
import markdownRenderer from './markdown.js'
import storage from './storage.js'
import uiManager from './ui.js'

class ChatManager {
    constructor() {
        this.isInitialized = false
        this.currentMessageId = null
        this.currentContentContainer = null
        this.messageHistory = []
        this.isStreaming = false
        this.accumulatedContent = '' // 累积的流式内容
    }

    /**
     * 初始化聊天管理器
     */
    async init() {
        if (this.isInitialized)
            return

        // 初始化markdown渲染器
        await markdownRenderer.init()

        // 绑定UI事件
        this._bindUIEvents()

        // 加载历史记录
        this._loadHistory()

        this.isInitialized = true
        console.log('[Chat] 管理器初始化完成')
    }

    /**
     * 绑定UI事件
     * @private
     */
    _bindUIEvents() {
    // 发送消息事件
        document.addEventListener('ui:send', (e) => {
            this._handleSendMessage(e.detail.message)
        })

        // 清空对话事件
        document.addEventListener('ui:clear', () => {
            this._handleClearChat()
        })

        // 元数据操作事件
        document.addEventListener('ui:meta', (e) => {
            this._handleMetaAction(e.detail.action)
        })
    }

    /**
     * 加载历史记录
     * @private
     */
    _loadHistory() {
        this.messageHistory = storage.getChatHistory()
        console.log(`[Chat] 加载了 ${this.messageHistory.length} 条历史消息`)
    }

    /**
     * 处理发送消息
     * @param {string} message - 消息内容
     * @private
     */
    async _handleSendMessage(message) {
        if (this.isStreaming) {
            console.warn('[Chat] 当前正在流式传输，忽略新消息')
            return
        }

        try {
            // 更新UI状态
            uiManager.setState('sending', '发送中...')
            uiManager.addUserMessage(message)
            uiManager.clearSteps()

            // 添加到历史记录
            this.messageHistory.push({
                role: 'user',
                content: message,
                timestamp: Date.now(),
            })

            // 准备AI消息容器
            this.currentContentContainer = uiManager.addAIMessage()
            this.accumulatedContent = '' // 重置累积内容

            // 获取设置
            const settings = uiManager.getSettings()

            // 发送请求
            this.isStreaming = true
            await api.sendMessage({
                message,
                history: this.messageHistory.slice(-10), // 只保留最近10条
                baseUrl: settings.baseUrl,
            }, {
                onChunk: chunk => this._handleChunk(chunk),
                onComplete: () => this._handleComplete(),
                onError: error => this._handleError(error),
            })
        }
        catch (error) {
            this._handleError(error)
        }
    }

    /**
     * 处理流式数据块
     * @param {string} chunk - Markdown格式的数据块
     * @private
     */
    _handleChunk(chunk) {
        try {
            // 首先尝试解析JSON格式（保持兼容性）
            try {
                const data = JSON.parse(chunk)

                if (data.type === 'react_step') {
                    // ReAct步骤
                    uiManager.addReactStep(data.content)
                    return
                }
                else if (data.type === 'response') {
                    // AI回复内容
                    if (this.currentContentContainer) {
                        this.accumulatedContent += data.content
                        const html = markdownRenderer.render(this.accumulatedContent)
                        setHTML(this.currentContentContainer, html)
                    }
                    return
                }
                else if (data.type === 'status') {
                    // 状态更新
                    uiManager.setState('sending', data.content)
                    return
                }
            }
            catch {
                // 不是JSON格式，按Markdown流式数据处理
            }

            // 处理Markdown格式的流式数据
            if (this.currentContentContainer && chunk.trim()) {
                this.accumulatedContent += chunk
                const html = markdownRenderer.render(this.accumulatedContent)
                setHTML(this.currentContentContainer, html)
            }
        }
        catch (error) {
            console.warn('[Chat] 处理数据块失败:', error, '原始数据:', chunk)
        }
    }

    /**
     * 处理完成事件
     * @private
     */
    _handleComplete() {
        this.isStreaming = false
        uiManager.setState('idle')

        // 保存AI回复到历史记录
        if (this.accumulatedContent.trim()) {
            this.messageHistory.push({
                role: 'assistant',
                content: this.accumulatedContent,
                timestamp: Date.now(),
            })

            // 保存历史记录
            storage.saveChatHistory(this.messageHistory)
        }

        this.currentContentContainer = null

        // 聚焦输入框
        setTimeout(() => {
            uiManager.focusInput()
        }, 100)
    }

    /**
     * 处理错误
     * @param {Error} error - 错误对象
     * @private
     */
    _handleError(error) {
        console.error('[Chat] 发送消息失败:', error)

        this.isStreaming = false
        uiManager.setState('error', '发送失败')

        if (this.currentContentContainer) {
            setHTML(this.currentContentContainer, `<div class="error">发送失败: ${error.message}</div>`,
            )
        }

        // 3秒后恢复状态
        setTimeout(() => {
            uiManager.setState('idle')
        }, 3000)
    }

    /**
     * 处理清空聊天
     * @private
     */
    _handleClearChat() {
        this.messageHistory = []
        storage.clearChatHistory()
        uiManager.clearAll()
        uiManager.setState('idle')

        console.log('[Chat] 聊天记录已清空')
    }

    /**
     * 处理元数据操作
     * @param {string} action - 操作类型
     * @private
     */
    async _handleMetaAction(action) {
        try {
            uiManager.setState('sending', '查询中...')

            const settings = uiManager.getSettings()
            let result

            if (action === 'agents') {
                result = await api.listAgents(settings.baseUrl)
            }
            else if (action === 'tools') {
                result = await api.listTools(settings.baseUrl)
            }

            if (result) {
                uiManager.setMetaContent(JSON.stringify(result, null, 2))
            }

            uiManager.setState('idle')
        }
        catch (error) {
            console.error('[Chat] 元数据操作失败:', error)
            uiManager.setMetaContent(`错误: ${error.message}`)
            uiManager.setState('error', '查询失败')

            setTimeout(() => {
                uiManager.setState('idle')
            }, 3000)
        }
    }

    /**
     * 重新发送最后一条消息
     */
    async resendLast() {
        const lastUserMessage = [...this.messageHistory]
            .reverse()
            .find(msg => msg.role === 'user')

        if (lastUserMessage) {
            await this._handleSendMessage(lastUserMessage.content)
        }
    }

    /**
     * 获取聊天历史
     * @returns {Array}
     */
    getHistory() {
        return [...this.messageHistory]
    }

    /**
     * 设置历史记录
     * @param {Array} history - 历史记录
     */
    setHistory(history) {
        this.messageHistory = history || []
        storage.saveChatHistory(this.messageHistory)
    }

    /**
     * 添加系统消息
     * @param {string} message - 消息内容
     */
    addSystemMessage(message) {
        const container = uiManager.addAIMessage()
        if (container) {
            const html = markdownRenderer.render(message)
            setHTML(container, html)
        }
    }

    /**
     * 导出聊天记录
     * @returns {string}
     */
    exportHistory() {
        const history = this.getHistory()
        const markdown = history.map((msg) => {
            const role = msg.role === 'user' ? '用户' : 'AI'
            const time = new Date(msg.timestamp).toLocaleString('zh-CN')
            return `## ${role} (${time})\n\n${msg.content}\n`
        }).join('\n---\n\n')

        return markdown
    }

    /**
     * 导入聊天记录
     * @param {string} _markdown - Markdown格式的历史记录
     */
    importHistory(_markdown) {
    // 这里可以实现从Markdown解析历史记录的逻辑
    // 为了简单起见，暂时不实现
        console.log('[Chat] 导入功能待实现')
    }

    /**
     * 获取状态
     * @returns {object}
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            streaming: this.isStreaming,
            historyCount: this.messageHistory.length,
            currentMessageId: this.currentMessageId,
        }
    }
}

// 创建单例实例
const chatManager = new ChatManager()

export default chatManager
