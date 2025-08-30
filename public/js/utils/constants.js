/**
 * Bot Server Chat Interface - 常量定义
 */

// API端点
export const API_ENDPOINTS = {
    CHAT_STREAM: '/api/chat/stream',
    LIST_AGENTS: '/api/list/agents',
    LIST_TOOLS: '/api/list/tools',
    HEALTH: '/api/health',
}

// 默认配置
export const DEFAULT_CONFIG = {
    BASE_URL: 'http://localhost:3000',
    REACT_VERBOSE: true,
    MAX_RETRIES: 3,
    TIMEOUT: 30000,
}

// UI状态
export const UI_STATES = {
    IDLE: 'idle',
    PROCESSING: 'processing',
    SUCCESS: 'success',
    ERROR: 'error',
}

// 预设消息
export const PRESET_MESSAGES = {
    hello: '你好，请用三句话介绍你自己',
    tool: '帮我查询antfe的成员信息',
    webcatcher: '请帮我抓取并分析 https://example.com 的内容，用Markdown格式输出',
}

// 存储键名
export const STORAGE_KEYS = {
    CHAT_CONFIG: 'chatbase',
    CONVERSATION_HISTORY: 'chat_history',
}

// CDN配置
export const CDN_CONFIG = {
    primary: {
        marked: 'https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js',
        highlight: 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/highlight.min.js',
        katex: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
        mermaid: 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js',
    },
    backup: {
        marked: 'https://unpkg.com/marked@12.0.0/marked.min.js',
        highlight: 'https://unpkg.com/highlight.js@11.9.0/highlight.min.js',
        katex: 'https://unpkg.com/katex@0.16.9/dist/katex.min.js',
        mermaid: 'https://unpkg.com/mermaid@10.6.1/dist/mermaid.min.js',
    },
}

// Markdown配置
export const MARKDOWN_CONFIG = {
    languages: ['javascript', 'typescript', 'python', 'json', 'bash', 'html', 'css', 'sql'],
    mermaid: {
        theme: 'default',
        securityLevel: 'loose',
        startOnLoad: false,
    },
    marked: {
        gfm: true,
        breaks: true,
        sanitize: false,
        smartypants: true,
    },
}

// 错误消息
export const ERROR_MESSAGES = {
    NETWORK_ERROR: '网络连接失败，请检查网络设置',
    PARSE_ERROR: '响应解析失败，请稍后重试',
    TIMEOUT_ERROR: '请求超时，请稍后重试',
    SERVER_ERROR: '服务器错误，请稍后重试',
    UNKNOWN_ERROR: '未知错误，请稍后重试',
}
