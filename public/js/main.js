/**
 * 主入口文件
 * 整合所有模块，启动应用
 */

import chatManager from './modules/chat.js'
import markdownRenderer from './modules/markdown.js'
import storage from './modules/storage.js'
import uiManager from './modules/ui.js'

/**
 * 应用主类
 */
class App {
    constructor() {
        this.isInitialized = false
        this.modules = {
            ui: uiManager,
            chat: chatManager,
            storage,
            markdown: markdownRenderer,
        }
    }

    /**
     * 初始化应用
     */
    async init() {
        if (this.isInitialized)
            return

        try {
            console.log('[App] 开始初始化应用...')

            // 显示加载状态
            this._showLoadingState()

            // 按顺序初始化模块
            await this._initModules()

            // 设置全局错误处理
            this._setupErrorHandling()

            // 设置快捷键
            this._setupKeyboardShortcuts()

            // 完成初始化
            this.isInitialized = true
            console.log('[App] 应用初始化完成')

            // 隐藏加载状态
            this._hideLoadingState()

            // 聚焦输入框
            uiManager.focusInput()
        }
        catch (error) {
            console.error('[App] 应用初始化失败:', error)
            this._showError(`应用初始化失败: ${error.message}`)
        }
    }

    /**
     * 显示加载状态
     * @private
     */
    _showLoadingState() {
        uiManager.setState('loading', '初始化中...')
    }

    /**
     * 隐藏加载状态
     * @private
     */
    _hideLoadingState() {
        uiManager.setState('idle')
    }

    /**
     * 初始化所有模块
     * @private
     */
    async _initModules() {
    // 1. 初始化存储模块
        console.log('[App] 初始化存储模块...')
        storage.init()

        // 2. 初始化UI管理器
        console.log('[App] 初始化UI管理器...')
        uiManager.init()

        // 3. 初始化聊天管理器（包含markdown渲染器）
        console.log('[App] 初始化聊天管理器...')
        await chatManager.init()

        console.log('[App] 所有模块初始化完成')
    }

    /**
     * 设置全局错误处理
     * @private
     */
    _setupErrorHandling() {
    // 捕获未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            console.error('[App] 未处理的Promise拒绝:', event.reason)
            this._showError(`发生未知错误: ${event.reason}`)
            event.preventDefault()
        })

        // 捕获全局错误
        window.addEventListener('error', (event) => {
            console.error('[App] 全局错误:', event.error)
            this._showError(`发生错误: ${event.error.message}`)
        })
    }

    /**
     * 设置快捷键
     * @private
     */
    _setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter: 发送消息
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                const sendBtn = document.getElementById('sendBtn')
                if (sendBtn && !sendBtn.disabled) {
                    sendBtn.click()
                }
            }

            // Ctrl/Cmd + K: 清空对话
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                const clearBtn = document.getElementById('clearBtn')
                if (clearBtn) {
                    clearBtn.click()
                }
            }

            // Ctrl/Cmd + /: 聚焦输入框
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault()
                uiManager.focusInput()
            }

            // Escape: 取消当前操作
            if (e.key === 'Escape') {
                // 这里可以添加取消当前请求的逻辑
                console.log('[App] Escape键被按下')
            }
        })
    }

    /**
     * 显示错误信息
     * @param {string} message - 错误消息
     * @private
     */
    _showError(message) {
    // 在聊天区域显示错误消息
        chatManager.addSystemMessage(`❌ **错误**: ${message}`)

        // 更新状态
        uiManager.setState('error', '出现错误')

        // 3秒后恢复状态
        setTimeout(() => {
            uiManager.setState('idle')
        }, 3000)
    }

    /**
     * 重启应用
     */
    async restart() {
        console.log('[App] 重启应用...')

        this.isInitialized = false

        // 清理状态
        uiManager.clearAll()

        // 重新初始化
        await this.init()
    }

    /**
     * 获取应用状态
     * @returns {object}
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            modules: Object.fromEntries(
                Object.entries(this.modules).map(([name, module]) => [
                    name,
                    typeof module.getStatus === 'function' ? module.getStatus() : 'loaded',
                ]),
            ),
        }
    }

    /**
     * 显示帮助信息
     */
    showHelp() {
        const helpMessage = `
# 🤖 Bot Server 使用帮助

## 🎯 功能特点
- **多轮对话**: 支持上下文对话，可以继续之前的话题
- **工具调用**: AI可以调用各种工具来完成复杂任务
- **ReAct步骤**: 实时显示AI的思考和执行过程
- **流式传输**: 实时显示AI回复，无需等待
- **网页抓取**: 支持智能网页内容抓取和分析

## ⌨️ 快捷键
- **Ctrl/Cmd + Enter**: 发送消息
- **Ctrl/Cmd + K**: 清空对话
- **Ctrl/Cmd + /**: 聚焦输入框
- **Escape**: 取消当前操作

## 🔧 预设消息
- **普通对话**: 测试基本对话功能
- **工具调用**: 测试AI工具调用能力
- **网页抓取**: 测试智能网页抓取功能

## 📝 使用提示
1. 在输入框中输入问题或指令
2. 可以使用"再查一次"、"重新查询"等上下文指令
3. 支持Markdown格式显示，包括代码高亮、数学公式等
4. 右侧面板显示AI的思考步骤和可用工具

## 🛠️ 设置
- **Base URL**: 配置API服务器地址
- **Agents/Tools**: 查看可用的智能体和工具

开始愉快地与AI对话吧！ 🚀
    `

        chatManager.addSystemMessage(helpMessage)
    }
}

/**
 * 应用启动函数
 */
async function startApp() {
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp)
        return
    }

    try {
        const app = new App()

        // 将app实例暴露到全局作用域（用于调试）
        window.app = app

        // 初始化应用
        await app.init()

        // 显示欢迎消息
        setTimeout(() => {
            app.showHelp()
        }, 500)
    }
    catch (error) {
        console.error('[App] 启动失败:', error)

        // 降级显示错误
        const chatList = document.getElementById('chatList')
        if (chatList) {
            chatList.innerHTML = `
        <div class="error" style="padding: 1rem; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; margin: 1rem 0;">
          <h3>❌ 应用启动失败</h3>
          <p>错误信息: ${error.message}</p>
          <p>请刷新页面重试，或检查控制台获取更多信息。</p>
        </div>
      `
        }
    }
}

// 启动应用
startApp()
