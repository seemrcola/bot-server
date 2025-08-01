/**
 * LLM 相关类型定义
 */

import type { ToolParameters } from './agent.types.js';

// ==================== LLM 配置（参考 langchain ChatOpenAI） ====================

export interface LLMConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  streaming?: boolean;
  configuration?: {
    baseURL?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    [key: string]: any;
  };
  timeout?: number;
  maxRetries?: number;
  maxTokens?: number;
}

// ==================== 意图分析 ====================

export interface IntentAnalysisResult {
  toolName: string | null;
  confidence: number;
  reasoning: string;
  alternatives?: Array<{toolName: string; confidence: number}>;
}

// ==================== 参数提取 ====================

export interface ParameterExtractionResult {
  parameters: ToolParameters;
  missingRequired: string[];
  suggestions: Record<string, string>;
  confidence: number;
}

// ==================== 增强分析结果 ====================

export interface EnhancedAnalysisResult {
  intent: string;
  confidence: number;
  parameters: ToolParameters;
  suggestedTool?: string | undefined;
  reasoning: string;
  alternatives: Array<{intent: string; confidence: number}>;
  processingTime: number;
  llmUsed: boolean;
  fallbackReason?: string;
}

// ==================== 对话上下文 ====================

export interface ConversationContext {
  previousMessages: Array<{role: string; content: string}>;
  sessionId: string;
  userId: string;
}

// ==================== LLM 服务接口 ====================

export interface ILLMService {
  generateCompletion(prompt: string, options?: any): Promise<string>;
  isHealthy(): boolean;
}

// ==================== LLM 指标 ====================

export interface LLMMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime?: Date;
}
