/**
 * 配置验证工具
 */

import type { MCPAgentConfig, LLMConfig } from '../types/index.js';

/**
 * 配置验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 验证配置
 */
export function validateConfig(config: MCPAgentConfig): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // 验证LLM配置
  if (config.llm) {
    validateLLMConfig(config.llm, result);
  }

  // 验证服务端配置
  if (config.server.port < 1 || config.server.port > 65535) {
    result.errors.push('服务端端口必须在1-65535之间');
  }

  // 验证客户端配置
  if (!config.client.serverUrl) {
    result.errors.push('客户端服务器URL不能为空');
  }

  // 设置最终验证状态
  result.isValid = result.errors.length === 0;

  return result;
}

/**
 * 验证LLM配置
 */
function validateLLMConfig(llmConfig: LLMConfig, result: ValidationResult): void {
  if (!llmConfig.apiKey) {
    result.warnings.push('LLM API密钥未配置，某些功能可能无法使用');
  } else if (llmConfig.apiKey.length < 10) {
    result.warnings.push('LLM API密钥长度可能不足');
  }

  if (!llmConfig.model) {
    result.errors.push('LLM模型不能为空');
  }

  if (llmConfig.temperature !== undefined) {
    if (llmConfig.temperature < 0 || llmConfig.temperature > 2) {
      result.errors.push('LLM温度参数必须在0-2之间');
    }
  }
}

/**
 * 获取配置健康状态
 */
export function getConfigHealth(): {
  isHealthy: boolean;
  issues: string[];
  summary: any;
} {
  // 这个函数将在index.ts中实现，这里只是类型定义
  return {
    isHealthy: true,
    issues: [],
    summary: {}
  };
}