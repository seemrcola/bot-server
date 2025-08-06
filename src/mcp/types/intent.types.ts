/**
 * 意图分析相关类型定义
 */

/**
 * 任务类型枚举
 */
export enum TaskType {
  /** 简单对话任务，不需要工具 */
  SIMPLE_CHAT = 'simple_chat',
  /** 工具调用任务，需要使用工具 */
  TOOL_CALL = 'tool_call',
  /** 混合任务，可能需要工具也可能不需要 */
  HYBRID = 'hybrid'
}

/**
 * 任务优先级
 */
export enum TaskPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4
}

/**
 * 单个子任务定义
 */
export interface SubTask {
  /** 任务唯一标识 */
  id: string;
  /** 任务内容/描述 */
  content: string;
  /** 任务类型 */
  type: TaskType;
  /** 是否需要工具调用 */
  needsTool: boolean;
  /** 可能需要的工具名称列表 */
  suggestedTools?: string[];
  /** 任务优先级 */
  priority: TaskPriority;
  /** 任务执行顺序（数字越小越先执行） */
  order: number;
  /** 是否可以与其他任务并行执行 */
  canParallel: boolean;
  /** 依赖的其他任务ID列表 */
  dependencies?: string[];
  /** 任务的预期输出类型 */
  expectedOutputType?: 'text' | 'json' | 'mixed';
  /** 工具调用所需的参数 */
  parameters?: Record<string, any>;
}

/**
 * 意图分析结果
 */
export interface IntentAnalysisResult {
  /** 原始用户消息 */
  originalMessage: string;
  /** 分解后的子任务列表 */
  subTasks: SubTask[];
  /** 整体意图类型 */
  overallType: TaskType;
  /** 是否包含工具调用任务 */
  hasToolTasks: boolean;
  /** 是否包含简单对话任务 */
  hasSimpleTasks: boolean;
  /** 分析置信度 (0-1) */
  confidence: number;
  /** 分析时间戳 */
  timestamp: number;
  /** 额外的上下文信息 */
  context?: {
    /** 用户历史偏好 */
    userPreferences?: any;
    /** 会话上下文 */
    sessionContext?: any;
    /** 环境信息 */
    environment?: any;
  };
}

/**
 * 任务执行结果
 */
export interface TaskExecutionResult {
  /** 任务ID */
  taskId: string;
  /** 执行是否成功 */
  success: boolean;
  /** 执行结果数据 */
  result?: any;
  /** 错误信息（如果失败） */
  error?: string;
  /** 执行耗时（毫秒） */
  duration: number;
  /** 使用的工具名称（如果有） */
  toolUsed?: string;
  /** 执行时间戳 */
  timestamp: number;
}

/**
 * 混合处理结果
 */
export interface HybridProcessingResult {
  /** 原始消息 */
  originalMessage: string;
  /** 意图分析结果 */
  intentAnalysis: IntentAnalysisResult;
  /** 各个任务的执行结果 */
  taskResults: TaskExecutionResult[];
  /** 最终合并的响应 */
  finalResponse: string;
  /** 整体处理是否成功 */
  success: boolean;
  /** 总执行时间 */
  totalDuration: number;
  /** 处理时间戳 */
  timestamp: number;
}

/**
 * 意图分析器配置
 */
export interface IntentAnalyzerConfig {
  /** 最大子任务数量 */
  maxSubTasks: number;
  /** 最小置信度阈值 */
  minConfidence: number;
  /** 是否启用并行执行 */
  enableParallelExecution: boolean;
  /** 任务超时时间（毫秒） */
  taskTimeout: number;
  /** 是否启用上下文感知 */
  enableContextAware: boolean;
  /** 工具调用超时时间（毫秒） */
  toolCallTimeout: number;
}

/**
 * 任务执行器配置
 */
export interface TaskExecutorConfig {
  /** 最大并行任务数 */
  maxParallelTasks: number;
  /** 任务重试次数 */
  maxRetries: number;
  /** 重试延迟（毫秒） */
  retryDelay: number;
  /** 是否启用任务缓存 */
  enableTaskCache: boolean;
  /** 缓存过期时间（毫秒） */
  cacheExpiration: number;
}
