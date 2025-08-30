/**
 * 本地存储模块
 * 负责管理配置持久化和对话历史记录
 */

import { DEFAULT_CONFIG, STORAGE_KEYS } from '../utils/constants.js'

class StorageManager {
    constructor() {
        this.isSupported = this.checkLocalStorageSupport()
        this.isInitialized = false
    }

    /**
     * 初始化存储管理器
     */
    init() {
        if (this.isInitialized) return
        
        console.log('[Storage] 存储管理器初始化完成')
        this.isInitialized = true
        
        // 执行清理过期数据
        this.cleanupExpiredData()
    }

    /**
     * 检查localStorage支持
     * @returns {boolean}
     */
    checkLocalStorageSupport() {
        try {
            const test = '__storage_test__'
            localStorage.setItem(test, test)
            localStorage.removeItem(test)
            return true
        }
        catch (e) {
            console.warn('LocalStorage不可用，将使用内存存储')
            return false
        }
    }

    /**
     * 获取存储项
     * @param {string} key - 存储键
     * @param {*} defaultValue - 默认值
     * @returns {*}
     */
    getItem(key, defaultValue = null) {
        if (!this.isSupported) {
            return defaultValue
        }

        try {
            const item = localStorage.getItem(key)
            return item ? JSON.parse(item) : defaultValue
        }
        catch (e) {
            console.warn(`获取存储项失败: ${key}`, e)
            return defaultValue
        }
    }

    /**
     * 设置存储项
     * @param {string} key - 存储键
     * @param {*} value - 存储值
     * @returns {boolean}
     */
    setItem(key, value) {
        if (!this.isSupported) {
            return false
        }

        try {
            localStorage.setItem(key, JSON.stringify(value))
            return true
        }
        catch (e) {
            console.warn(`设置存储项失败: ${key}`, e)
            return false
        }
    }

    /**
     * 删除存储项
     * @param {string} key - 存储键
     * @returns {boolean}
     */
    removeItem(key) {
        if (!this.isSupported) {
            return false
        }

        try {
            localStorage.removeItem(key)
            return true
        }
        catch (e) {
            console.warn(`删除存储项失败: ${key}`, e)
            return false
        }
    }

    /**
     * 清空所有存储
     * @returns {boolean}
     */
    clear() {
        if (!this.isSupported) {
            return false
        }

        try {
            localStorage.clear()
            return true
        }
        catch (e) {
            console.warn('清空存储失败', e)
            return false
        }
    }

    /**
     * 获取聊天配置
     * @returns {object}
     */
    getChatConfig() {
        const config = this.getItem(STORAGE_KEYS.CHAT_CONFIG, {})
        return {
            ...DEFAULT_CONFIG,
            ...config,
        }
    }

    /**
     * 保存聊天配置
     * @param {object} config - 配置对象
     * @returns {boolean}
     */
    saveChatConfig(config) {
        const currentConfig = this.getChatConfig()
        const newConfig = { ...currentConfig, ...config }
        return this.setItem(STORAGE_KEYS.CHAT_CONFIG, newConfig)
    }

    /**
     * 获取对话历史
     * @returns {Array}
     */
    getConversationHistory() {
        return this.getItem(STORAGE_KEYS.CONVERSATION_HISTORY, [])
    }

    /**
     * 保存对话历史
     * @param {Array} history - 对话历史
     * @returns {boolean}
     */
    saveConversationHistory(history) {
    // 限制历史记录数量，避免存储过大
        const maxHistoryLength = 100
        const limitedHistory = history.slice(-maxHistoryLength)
        return this.setItem(STORAGE_KEYS.CONVERSATION_HISTORY, limitedHistory)
    }

    /**
     * 清空对话历史
     * @returns {boolean}
     */
    clearConversationHistory() {
        return this.removeItem(STORAGE_KEYS.CONVERSATION_HISTORY)
    }

    /**
     * 获取用户偏好
     * @returns {object}
     */
    getUserPreferences() {
        return this.getItem(STORAGE_KEYS.USER_PREFERENCES, {
            theme: 'light',
            markdownEnabled: true,
            autoScroll: true,
            reactVerbose: true,
            showTimestamps: false,
        })
    }

    /**
     * 保存用户偏好
     * @param {object} preferences - 用户偏好
     * @returns {boolean}
     */
    saveUserPreferences(preferences) {
        const currentPrefs = this.getUserPreferences()
        const newPrefs = { ...currentPrefs, ...preferences }
        return this.setItem(STORAGE_KEYS.USER_PREFERENCES, newPrefs)
    }

    /**
     * 导出所有数据
     * @returns {object}
     */
    exportData() {
        return {
            config: this.getChatConfig(),
            history: this.getConversationHistory(),
            preferences: this.getUserPreferences(),
            exportTime: new Date().toISOString(),
        }
    }

    /**
     * 导入数据
     * @param {object} data - 要导入的数据
     * @returns {boolean}
     */
    importData(data) {
        try {
            if (data.config) {
                this.saveChatConfig(data.config)
            }
            if (data.history) {
                this.saveConversationHistory(data.history)
            }
            if (data.preferences) {
                this.saveUserPreferences(data.preferences)
            }
            return true
        }
        catch (e) {
            console.error('导入数据失败', e)
            return false
        }
    }

    /**
     * 获取存储使用情况
     * @returns {object}
     */
    getStorageUsage() {
        if (!this.isSupported) {
            return { used: 0, quota: 0, percentage: 0 }
        }

        try {
            let totalSize = 0
            for (const key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length + key.length
                }
            }

            // 估算的存储配额（通常为5-10MB）
            const estimatedQuota = 5 * 1024 * 1024 // 5MB
            const percentage = (totalSize / estimatedQuota) * 100

            return {
                used: totalSize,
                quota: estimatedQuota,
                percentage: Math.min(percentage, 100),
            }
        }
        catch (e) {
            console.warn('获取存储使用情况失败', e)
            return { used: 0, quota: 0, percentage: 0 }
        }
    }

    /**
     * 清理过期数据
     * @param {number} maxAge - 最大保存时间（毫秒）
     * @returns {boolean}
     */
    cleanupExpiredData(maxAge = 7 * 24 * 60 * 60 * 1000) { // 默认7天
        try {
            const now = Date.now()
            const history = this.getConversationHistory()

            // 清理过期的对话历史
            const filteredHistory = history.filter((message) => {
                return !message.timestamp || (now - message.timestamp) < maxAge
            })

            if (filteredHistory.length !== history.length) {
                this.saveConversationHistory(filteredHistory)
                console.log(`清理了 ${history.length - filteredHistory.length} 条过期对话记录`)
            }

            return true
        }
        catch (e) {
            console.error('清理过期数据失败', e)
            return false
        }
    }

    // ======================
    // 便捷方法别名（为了兼容其他模块的调用）
    // ======================
    
    /**
     * 获取配置（别名）
     * @returns {object}
     */
    getConfig() {
        return this.getChatConfig()
    }
    
    /**
     * 保存配置（别名）
     * @param {object} config - 配置对象
     * @returns {boolean}
     */
    saveConfig(config) {
        return this.saveChatConfig(config)
    }
    
    /**
     * 获取聊天历史（别名）
     * @returns {Array}
     */
    getChatHistory() {
        return this.getConversationHistory()
    }
    
    /**
     * 保存聊天历史（别名）
     * @param {Array} history - 对话历史
     * @returns {boolean}
     */
    saveChatHistory(history) {
        return this.saveConversationHistory(history)
    }
    
    /**
     * 清空聊天历史（别名）
     * @returns {boolean}
     */
    clearChatHistory() {
        return this.clearConversationHistory()
    }

    /**
     * 获取状态
     * @returns {Object}
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            supported: this.isSupported,
            usage: this.getStorageUsage()
        }
    }
}

// 创建单例实例
const storageManager = new StorageManager()

export default storageManager
