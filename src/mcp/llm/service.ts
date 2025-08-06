/**
 * 简化的 LLM 服务
 * 使用配置中心进行配置管理，支持配置热更新
 */

import { LLMConfig, ILLMService, LLMMetrics } from '../types/index.js';
import { 
  LLMServiceError, 
  LLMTimeoutError, 
  LLMAuthenticationError,
  LLMRateLimitError,
  LLMQuotaExceededError 
} from './errors.js';
import { createMCPLogger } from '../utils/logger.js';
import { configManager } from '../config/manager.js';

const logger = createMCPLogger('LLMService');

export class LLMService implements ILLMService {
  private config: LLMConfig;    // LLM 配置
  private metrics: LLMMetrics;  // LLM 指标

  constructor(config?: LLMConfig) {
    // 优先使用传入的配置，否则从全局配置管理器获取
    const globalConfig = configManager.getConfig();
    const llmConfig = config || globalConfig.llm;
    
    if (!llmConfig) {
        throw new LLMServiceError('LLM configuration is missing.');
    }
    
    this.config = llmConfig;

    this.metrics = {
      totalRequests: 0,        // 总请求数
      successfulRequests: 0,   // 成功请求数
      failedRequests: 0,       // 失败请求数
      averageResponseTime: 0   // 平均响应时间
    };
    
    logger.info('LLM服务已初始化', {
      model: this.config.model,
      baseURL: this.config.configuration?.baseURL
    });
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    logger.info('LLM服务已销毁');
  }

  /**
   * 生成文本补全
   */
  async generateCompletion(prompt: string, options?: any): Promise<string> {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = new Date();

    try {
      logger.debug('Generating LLM completion', {
        model: this.config.model,
        promptLength: prompt.length
      });

      // 使用统一的 OpenAI 兼容 API 调用
      const result = await this.callOpenAICompatible(prompt, options);

      // 更新成功指标
      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

      logger.debug('LLM completion generated successfully', {
        responseTime,
        resultLength: result.length
      });

      return result;

    } catch (error) {
      // 更新失败指标
      this.updateMetrics(false, Date.now() - startTime);
      
      logger.error('LLM completion failed', error);
      throw this.handleError(error);
    }
  }

  /**
   * 调用 OpenAI 兼容 API（统一接口）
   */
  private async callOpenAICompatible(prompt: string, options?: any): Promise<string> {
    const { apiKey, model, configuration } = this.config;
    const url = `${configuration?.baseURL || 'https://api.deepseek.com/v1'}/chat/completions`;

    logger.debug('Calling real OpenAI compatible API', { url, model });

    const body = {
      model: model,
      messages: [{ role: 'user', content: prompt }],
      stream: false, // ReAct 流程需要一次性返回
      ...options,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeout || 30000), // 30秒超时
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error('LLM API request failed', { status: response.status, body: errorBody });
        throw new LLMServiceError(`API request failed with status ${response.status}: ${errorBody}`);
      }

      const jsonResponse = await response.json();
      const content = jsonResponse.choices[0]?.message?.content;

      if (!content) {
        logger.warn('LLM response content is empty', { response: jsonResponse });
        throw new LLMServiceError('LLM response content is empty or in an unexpected format.');
      }

      return content.trim();

    } catch (error) {
       if (error instanceof Error && error.name === 'TimeoutError') {
         logger.error('LLM API request timed out', { timeout: this.config.timeout });
         throw new LLMTimeoutError();
       }
       logger.error('Error calling LLM API', { error });
       throw this.handleError(error);
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: any): Error {
    if (error instanceof LLMServiceError) {
      return error;
    }

    // 根据错误类型返回相应的错误
    const errorMessage = error.message || String(error);
    
    if (errorMessage.includes('timeout')) {
      return new LLMTimeoutError();
    }
    
    if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
      return new LLMAuthenticationError();
    }
    
    if (errorMessage.includes('rate limit')) {
      return new LLMRateLimitError();
    }
    
    if (errorMessage.includes('quota')) {
      return new LLMQuotaExceededError();
    }

    return new LLMServiceError(`LLM服务调用失败: ${errorMessage}`, error);
  }

  /**
   * 更新指标
   */
  private updateMetrics(success: boolean, responseTime: number): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // 更新平均响应时间
    const totalSuccessful = this.metrics.successfulRequests;
    if (totalSuccessful > 0) {
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (totalSuccessful - 1) + responseTime) / totalSuccessful;
    }
  }

  /**
   * 检查服务健康状态
   */
  isHealthy(): boolean {
    const successRate = this.metrics.totalRequests > 0 
      ? this.metrics.successfulRequests / this.metrics.totalRequests 
      : 1;
    
    return successRate >= 0.8; // 80% 成功率认为是健康的
  }

  /**
   * 获取服务指标
   */
  getMetrics(): LLMMetrics {
    return { ...this.metrics };
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
    logger.info('LLM service metrics reset');
  }
}
