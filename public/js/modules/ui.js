/**
 * UI交互模块
 * 负责界面状态管理、按钮事件处理、页面切换等
 */

import { PRESET_MESSAGES, UI_STATES } from '../utils/constants.js'
import { $, $$, addClass, clearElement, createElement, removeClass, scrollToBottom, setText, toggleElement } from '../utils/dom.js'
import storage from './storage.js'

class UIManager {
    constructor() {
        this.elements = {}
        this.currentTab = 'steps'
        this.state = 'idle'
        this.isInitialized = false
    }

    /**
     * 初始化UI管理器
     */
    init() {
        if (this.isInitialized)
            return

        this._cacheElements()
        this._bindEvents()
        this._loadSettings()
        this._initPresetButtons()

        this.isInitialized = true
        console.log('[UI] 管理器初始化完成')
    }

    /**
     * 缓存DOM元素
     * @private
     */
    _cacheElements() {
        this.elements = {
            // 主要区域
            chatList: $('#chatList'),
            userInput: $('#userInput'),
            sendBtn: $('#sendBtn'),
            clearBtn: $('#clearBtn'),
            baseUrl: $('#baseUrl'),
            statePill: $('#statePill'),

            // 面板区域
            panelSteps: $('#panelSteps'),
            panelMeta: $('#panelMeta'),
            metaContent: $('#metaContent'),

            // 标签页
            tabSteps: $('#tabSteps'),
            tabMeta: $('#tabMeta'),

            // 按钮
            btnListAgents: $('#btnListAgents'),
            btnListTools: $('#btnListTools'),

            // 预设按钮
            presetBtns: $$('.preset-btn'),
        }

        console.log('[UI] DOM元素缓存完成')
    }

    /**
     * 绑定事件
     * @private
     */
    _bindEvents() {
    // 发送按钮
        this.elements.sendBtn?.addEventListener('click', () => {
            this._handleSend()
        })

        // 输入框回车
        this.elements.userInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                this._handleSend()
            }
        })

        // 清空按钮
        this.elements.clearBtn?.addEventListener('click', () => {
            this._handleClear()
        })

        // 设置输入框
        this.elements.baseUrl?.addEventListener('input', (e) => {
            storage.saveConfig({ baseUrl: e.target.value })
        })

        // 标签页切换
        this.elements.tabSteps?.addEventListener('click', () => {
            this._switchTab('steps')
        })

        this.elements.tabMeta?.addEventListener('click', () => {
            this._switchTab('meta')
        })

        // 元数据按钮
        this.elements.btnListAgents?.addEventListener('click', () => {
            this._triggerMetaAction('agents')
        })

        this.elements.btnListTools?.addEventListener('click', () => {
            this._triggerMetaAction('tools')
        })

        console.log('[UI] 事件绑定完成')
    }

    /**
     * 加载设置
     * @private
     */
    _loadSettings() {
        const config = storage.getConfig()
        if (this.elements.baseUrl && config.baseUrl) {
            this.elements.baseUrl.value = config.baseUrl
        }
    }

    /**
     * 初始化预设按钮
     * @private
     */
    _initPresetButtons() {
        this.elements.presetBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const preset = e.target.dataset.preset
                this._handlePreset(preset)
            })
        })
    }

    /**
     * 处理发送事件
     * @private
     */
    _handleSend() {
        const input = this.elements.userInput
        const message = input?.value?.trim()

        if (!message || this.state === 'sending')
            return

        // 触发自定义事件
        this._emit('send', { message })

        // 清空输入框
        if (input) {
            input.value = ''
            input.focus()
        }
    }

    /**
     * 处理清空事件
     * @private
     */
    _handleClear() {
        this._emit('clear')
    }

    /**
     * 处理预设消息
     * @private
     */
    _handlePreset(presetKey) {
        const message = PRESET_MESSAGES[presetKey]
        if (message && this.elements.userInput) {
            this.elements.userInput.value = message
            this.elements.userInput.focus()
        }
    }

    /**
     * 切换标签页
     * @private
     */
    _switchTab(tab) {
        this.currentTab = tab

        if (tab === 'steps') {
            // 显示steps面板
            removeClass(this.elements.tabSteps, 'bg-transparent')
            addClass(this.elements.tabSteps, 'bg-white')
            addClass(this.elements.tabMeta, 'bg-transparent')
            removeClass(this.elements.tabMeta, 'bg-white')

            toggleElement(this.elements.panelSteps, true)
            toggleElement(this.elements.panelMeta, false)
        }
        else {
            // 显示meta面板
            removeClass(this.elements.tabMeta, 'bg-transparent')
            addClass(this.elements.tabMeta, 'bg-white')
            addClass(this.elements.tabSteps, 'bg-transparent')
            removeClass(this.elements.tabSteps, 'bg-white')

            toggleElement(this.elements.panelSteps, false)
            toggleElement(this.elements.panelMeta, true)
        }
    }

    /**
     * 触发元数据操作
     * @private
     */
    _triggerMetaAction(action) {
        this._emit('meta', { action })
    }

    /**
     * 发射自定义事件
     * @private
     */
    _emit(type, data = {}) {
        const event = new CustomEvent(`ui:${type}`, { detail: data })
        document.dispatchEvent(event)
    }

    /**
     * 设置状态
     * @param {string} state - 状态值
     * @param {string} text - 状态文本
     */
    setState(state, text) {
        this.state = state

        if (this.elements.statePill) {
            setText(this.elements.statePill, text || UI_STATES[state] || state)

            // 更新状态样式
            this.elements.statePill.className = 'ml-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium'

            switch (state) {
                case 'idle':
                    addClass(this.elements.statePill, ['border-slate-200', 'bg-slate-100', 'text-slate-700'])
                    break
                case 'sending':
                    addClass(this.elements.statePill, ['border-blue-200', 'bg-blue-100', 'text-blue-700'])
                    break
                case 'error':
                    addClass(this.elements.statePill, ['border-red-200', 'bg-red-100', 'text-red-700'])
                    break
                default:
                    addClass(this.elements.statePill, ['border-slate-200', 'bg-slate-100', 'text-slate-700'])
            }
        }

        // 更新按钮状态
        if (this.elements.sendBtn) {
            this.elements.sendBtn.disabled = (state === 'sending')
        }
    }

    /**
     * 添加用户消息
     * @param {string} message - 消息内容
     */
    addUserMessage(message) {
        if (!this.elements.chatList)
            return

        const messageEl = createElement('div', {
            className: 'message-user chat-message',
        }, [
            createElement('div', { className: 'avatar' }, '你'),
            createElement('div', { className: 'content' }, message),
        ])

        this.elements.chatList.appendChild(messageEl)
        scrollToBottom(this.elements.chatList)
    }

    /**
     * 添加AI消息容器
     * @returns {Element} 消息内容容器
     */
    addAIMessage() {
        if (!this.elements.chatList)
            return null

        const contentDiv = createElement('div', { className: 'content prose' })
        const messageEl = createElement('div', {
            className: 'message-ai chat-message',
        }, [
            createElement('div', { className: 'avatar' }, 'AI'),
            contentDiv,
        ])

        this.elements.chatList.appendChild(messageEl)
        scrollToBottom(this.elements.chatList)

        return contentDiv
    }

    /**
     * 添加ReAct步骤
     * @param {string} step - 步骤内容
     */
    addReactStep(step) {
        if (!this.elements.panelSteps)
            return

        const stepEl = createElement('div', {
            className: 'react-step',
        }, step)

        this.elements.panelSteps.appendChild(stepEl)
        scrollToBottom(this.elements.panelSteps)
    }

    /**
     * 设置元数据内容
     * @param {string} content - 内容
     */
    setMetaContent(content) {
        if (this.elements.metaContent) {
            setText(this.elements.metaContent, content)
        }
    }

    /**
     * 清空聊天记录
     */
    clearChat() {
        if (this.elements.chatList) {
            clearElement(this.elements.chatList)
        }
    }

    /**
     * 清空ReAct步骤
     */
    clearSteps() {
        if (this.elements.panelSteps) {
            clearElement(this.elements.panelSteps)
        }
    }

    /**
     * 清空元数据
     */
    clearMeta() {
        if (this.elements.metaContent) {
            clearElement(this.elements.metaContent)
        }
    }

    /**
     * 清空所有内容
     */
    clearAll() {
        this.clearChat()
        this.clearSteps()
        this.clearMeta()
    }

    /**
     * 获取当前设置
     * @returns {object}
     */
    getSettings() {
        return {
            baseUrl: this.elements.baseUrl?.value || '',
            currentTab: this.currentTab,
            state: this.state,
        }
    }

    /**
     * 聚焦输入框
     */
    focusInput() {
        if (this.elements.userInput) {
            this.elements.userInput.focus()
        }
    }
}

// 创建单例实例
const uiManager = new UIManager()

export default uiManager
