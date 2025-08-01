/**
 * NLP 相关类型定义
 */

// ==================== NLP 配置 ====================

export interface NLPConfig {
  confidenceThreshold: number;
  maxRetries: number;
  useLLM: boolean;
  enableEntityExtraction?: boolean;
  enableSentimentAnalysis?: boolean;
  supportedLanguages?: string[];
}
