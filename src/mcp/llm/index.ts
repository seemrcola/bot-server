/**
 * LLM模块统一导出
 */

// 核心类
export { LLMNLPProcessor } from './processor.js';

export { LLMService } from './service.js';

// 类型
export type {
  LLMConfig,
  ILLMService,
  LLMMetrics,
  IntentAnalysisResult,
  ParameterExtractionResult,
  EnhancedAnalysisResult,
  AnalysisResult
} from '../types/index.js';

// 移除扩展类型定义

// 错误类
export {
  LLMServiceError,
  LLMTimeoutError,
  LLMQuotaExceededError,
  LLMAuthenticationError,
  LLMRateLimitError,
  LLMParsingError,
  LLMConfigurationError
} from './errors.js';

// 处理器选项
export type { LLMNLPProcessorOptions } from './processor.js';

// 默认配置
export const DEFAULT_LLM_CONFIG = {
  provider: 'deepseek' as const,
  model: 'deepseek-chat',
  timeout: 30000,
  maxRetries: 3,
  temperature: 0.1,
  maxTokens: 1000
};

// 工厂函数接口
export interface LLMNLPProcessorFactory {
  apiKey?: string;
  provider?: any;
  model?: string;
  enableFallback?: boolean;
  enableLearning?: boolean;
}
