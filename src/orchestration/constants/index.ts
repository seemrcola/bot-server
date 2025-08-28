/**
 * Orchestration 模块常量定义
 * 统一管理 Agent 编排、路由、LLM 相关的配置常量
 */

// ============ Agent 路由相关常量 ============

/**
 * Agent 路由置信度阈值
 */
export const ROUTING_CONFIDENCE = {
    /** 多Agent路由的默认置信度阈值（统一模式） */
    MULTI_AGENT_THRESHOLD: 0.3,
    /** 显式指定Agent时的固定置信度 */
    EXPLICIT_CONFIDENCE: 1.0,
    /** Leader兜底时的固定置信度 */
    LEADER_FALLBACK_CONFIDENCE: 1.0,
} as const

/**
 * Agent 数量限制
 */
export const AGENT_LIMITS = {
    /** 默认最大Agent数量（支持1-N个Agent） */
    DEFAULT_MAX_AGENTS: 5,
    /** 多Agent路由时的默认最大返回数量 */
    MULTI_ROUTE_MAX_AGENTS: 3,
    /** 最小Agent数量 */
    MIN_AGENTS: 1,
} as const

// ============ LLM 相关常量 ============

/**
 * LLM 模型配置
 */
export const LLM_CONFIG = {
    /** 默认采样温度 */
    DEFAULT_TEMPERATURE: 0.7,
    /** 流式输出开关 */
    STREAMING_ENABLED: true,
} as const

/**
 * Agent 执行相关常量
 */
export const EXECUTION_CONFIG = {
    /** 默认最大执行步数 */
    DEFAULT_MAX_STEPS: 8,
    /** 默认ReAct详细输出模式 */
    DEFAULT_REACT_VERBOSE: false,
} as const

// ============ 错误消息常量 ============

/**
 * Agent 路由错误类型
 */
export const ROUTING_ERRORS = {
    NO_LEADER: 'no_leader',
    INVOKE_ERROR: 'invoke_error',
    PARSE_ERROR: 'parse_error',
    EMPTY_TARGET: 'empty_target',
    TARGET_NOT_FOUND: 'target_not_found',
    LOW_CONFIDENCE: 'low_confidence',
    NO_VALID_AGENTS: 'no_valid_agents',
    INVALID_FORMAT: 'invalid_format',
} as const

/**
 * 支持的 LLM 提供商
 */
export const SUPPORTED_MODELS = {
    QWEN: 'qwen',
    DEEPSEEK: 'deepseek',
} as const

// ============ 环境变量键名 ============

/**
 * 环境变量键名常量
 */
export const ENV_KEYS = {
    LLM_PROVIDER: 'LLM_PROVIDER',
    LLM_API_KEY: 'LLM_API_KEY',
    LLM_MODEL: 'LLM_MODEL',
} as const

// ============ 导出类型 ============

export type RoutingError = typeof ROUTING_ERRORS[keyof typeof ROUTING_ERRORS]
export type SupportedModel = typeof SUPPORTED_MODELS[keyof typeof SUPPORTED_MODELS]
