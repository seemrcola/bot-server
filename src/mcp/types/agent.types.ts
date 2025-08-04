/**
 * MCP Agent 相关类型定义
 */

import { BaseMessage } from '@langchain/core/messages';

// ==================== MCP代理接口 ====================

export interface IMCPAgent {
  initialize(): Promise<void>;
  processMessage(message: string, context: ChatContext): Promise<MCPResponse>;
  shutdown(): Promise<void>;
  getStatus(): {
    initialized: boolean;
    enabled: boolean;
    clientConnected: boolean;
    serverRunning: boolean;
    registeredTools: string[];
    useLLMProcessor: boolean;
    llmHealthy?: boolean;
  };
  getAllToolKeywords(): string[];
  processMessageStream(message: string, context: ChatContext): AsyncIterable<string>;
}

export interface MCPResponse {
  needsToolCall: boolean;
  toolName?: string;
  toolResult?: any;
  enhancedMessage?: string;
  error?: string;
}

export interface ChatContext {
  messages: BaseMessage[];
  userId?: string;
  sessionId?: string;
  conversationHistory?: BaseMessage[];
  history?: any[];
}

// ==================== Plan-and-Execute 流程相关类型 ====================

export interface Plan {
  thought: string;
  tool_name: string;
  tool_input: Record<string, any>;
}

// ==================== 工具相关类型 (Tool-related Types) ====================

export interface ITool {
  name: string;
  description: string;
  keywords?: string[];
  parameters: ToolParameterSchema;
  _call(args: ToolParameters): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime?: number;
  isFinal?: boolean; // 关键字段，指示这是否是最终答案
}

export interface ToolParameters {
  [key: string]: any;
}

export interface ToolInfo {
  name: string;
  description: string;
  keywords?: string[];
  parameters: ToolParameterSchema;
  version: string;
  enabled: boolean;
  lastUsed?: Date;
  usageCount: number;
}

export interface ToolConfig {
  name: string;
  enabled: boolean;
  patterns: string[];
  parameters: any;
  description: string;
  examples: string[];
}

export interface ToolParameterSchema {
  type: 'object';
  properties: {
    [key: string]: {
      type: string;
      description: string;
      enum?: string[];
    };
  };
  required?: string[];
}

export interface ToolsConfig {
  [toolName: string]: ToolConfig;
}


// ==================== 自然语言处理器接口 ====================

export interface INLProcessor {
  analyzeMessage(message: string): Promise<AnalysisResult>;
  extractParameters(message: string, toolConfig: ToolConfig): Promise<ToolParameters>;
}

export interface AnalysisResult {
  intent: string;
  confidence: number;
  suggestedTool?: string | undefined;
  parameters?: Record<string, any>;
  entities?: Array<{
    type: string;
    value: string;
    confidence: number;
    start: number;
    end: number;
  }>;
}



// ==================== 执行上下文 ====================

export interface ExecutionContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  originalMessage: string;
  toolName?: string;
  parameters?: ToolParameters;
  result?: ToolResult;
  duration?: number;
}

// 导入其他模块的类型
import type { LLMConfig } from './llm.types.js';
import type { NLPConfig } from './nlp.types.js';
import type { MCPClientConfig } from './client.types.js';
import type { MCPServerConfig } from './server.types.js';
import type { LoggingConfig } from './config.types.js';

// ==================== 配置接口 ====================

export interface MCPAgentConfig {
  enabled: boolean;
  nlp: NLPConfig;
  client: MCPClientConfig;
  server: MCPServerConfig;
  tools: ToolsConfig;
  logging: LoggingConfig;
  llm?: LLMConfig;
}

// ==================== 深度可选配置类型 ====================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Record<string, any> 
    ? DeepPartial<T[P]> 
    : T[P];
};

export type PartialMCPAgentConfig = DeepPartial<MCPAgentConfig>;
