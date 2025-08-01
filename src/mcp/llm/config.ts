/**
 * 简化的 LLM 配置管理
 */

import { LLMConfig } from '../types/index.js';
import { LLMConfigurationError } from './errors.js';
import { createMCPLogger } from '../utils/logger.js';
import { getDefaultLLMConfig } from '../config/default.js';

const logger = createMCPLogger('LLMConfig');

export class LLMConfigManager {
  private config: LLMConfig;

  constructor(initialConfig?: Partial<LLMConfig>) {
    const defaultConfig = getDefaultLLMConfig();
    this.config = { ...defaultConfig, ...initialConfig } as LLMConfig;
    this.validateConfig();
  }

  /**
   * 获取配置
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<LLMConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    try {
      this.validateConfig();
      logger.info('LLM configuration updated', {
        changes: this.getConfigChanges(oldConfig, this.config)
      });
    } catch (error) {
      // 回滚配置
      this.config = oldConfig;
      throw error;
    }
  }

  /**
   * 验证配置
   */
  private validateConfig(): void {
    if (!this.config.apiKey) {
      throw new LLMConfigurationError('API密钥不能为空');
    }

    if (!this.config.model) {
      throw new LLMConfigurationError('模型名称不能为空');
    }

    if (this.config.timeout && this.config.timeout <= 0) {
      throw new LLMConfigurationError('超时时间必须大于0');
    }

    if (this.config.maxRetries && this.config.maxRetries < 0) {
      throw new LLMConfigurationError('最大重试次数不能为负数');
    }

    if (this.config.temperature && (this.config.temperature < 0 || this.config.temperature > 2)) {
      throw new LLMConfigurationError('温度参数必须在0-2之间');
    }

    if (this.config.maxTokens && this.config.maxTokens <= 0) {
      throw new LLMConfigurationError('最大令牌数必须大于0');
    }
  }

  /**
   * 获取配置变更
   */
  private getConfigChanges(oldConfig: LLMConfig, newConfig: LLMConfig): Record<string, any> {
    const changes: Record<string, any> = {};
    
    for (const key in newConfig) {
      if (oldConfig[key as keyof LLMConfig] !== newConfig[key as keyof LLMConfig]) {
        changes[key] = {
          from: oldConfig[key as keyof LLMConfig],
          to: newConfig[key as keyof LLMConfig]
        };
      }
    }
    
    return changes;
  }

  /**
   * 重置为默认配置
   */
  resetToDefault(): void {
    this.config = { ...getDefaultLLMConfig() } as LLMConfig;
    logger.info('LLM configuration reset to default');
  }

  /**
   * 检查配置是否有效
   */
  isValid(): boolean {
    try {
      this.validateConfig();
      return true;
    } catch {
      return false;
    }
  }
}
