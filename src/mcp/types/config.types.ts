/**
 * 配置相关类型定义
 */

export interface ToolConfig {
  name: string;
  enabled: boolean;
  patterns: string[];
  parameters: {
    [paramName: string]: {
      patterns: string[];
      default?: any;
      required: boolean;
      type: 'string' | 'number' | 'boolean' | 'object';
      description?: string;
      examples?: string[];
    };
  };
  description: string;
  examples: string[];
  apiKey?: string;
  [key: string]: any;
}
import type { LLMConfig } from './llm.types.js';
import type { NLPConfig } from './nlp.types.js';
import type { MCPClientConfig } from './client.types.js';
import type { MCPServerConfig } from './server.types.js';

// ==================== 主配置接口 ====================

export interface MCPConfig {
  enabled: boolean;
  server: MCPServerConfig;
  client: MCPClientConfig;
  tools: Record<string, ToolConfig>;
  nlp: NLPConfig;
  logging: LoggingConfig;
  llm?: LLMConfig;
}

// 新的配置类型别名，用于配置中心
export type ClientConfig = MCPClientConfig;
export type ServerConfig = MCPServerConfig;
export type ToolsConfig = Record<string, ToolConfig>;

// ==================== 日志配置 ====================

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  enablePerformanceLogging: boolean;
  enableFileLogging?: boolean;
  logFilePath?: string;
  maxLogFileSize?: number;
  maxLogFiles?: number;
}

// ==================== 运行时环境配置 ====================

export interface RuntimeEnvironment {
  NODE_ENV: 'development' | 'production' | 'test';
}

// ==================== 配置验证 ====================

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ==================== Agent配置 ====================

export interface MCPAgentConfig extends MCPConfig {
  // Agent特有的配置可以在这里扩展
}

// ==================== 配置更新事件 ====================

export interface ConfigUpdateEvent {
  section: keyof MCPConfig;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}
