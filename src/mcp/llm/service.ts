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
import { createLLMConfigProxy } from '../config/index.js';

const logger = createMCPLogger('LLMService');

export class LLMService implements ILLMService {
  private configProxy = createLLMConfigProxy();
  private config: LLMConfig;
  private metrics: LLMMetrics;
  private unsubscribeConfig: (() => void) | undefined;

  constructor(config?: LLMConfig) {
    // 优先使用传入的配置，否则从配置中心获取
    this.config = config || this.configProxy.getLLMConfig();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };

    // 订阅配置变更
    this.subscribeToConfigChanges();
    
    logger.info('LLM服务已初始化', {
      model: this.config.model,
      baseURL: this.config.configuration?.baseURL
    });
  }

  /**
   * 订阅配置变更
   */
  private subscribeToConfigChanges(): void {
    // 简化配置订阅
    this.unsubscribeConfig = () => {};
  }

  /**
   * 重新初始化服务
   */
  private reinitialize(): void {
    // 重置指标
    this.resetMetrics();
    
    logger.info('LLM服务已重新初始化', {
      model: this.config.model,
      baseURL: this.config.configuration?.baseURL
    });
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    if (this.unsubscribeConfig) {
      this.unsubscribeConfig();
      this.unsubscribeConfig = undefined;
    }
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
   * 调用 DeepSeek API
   */
  private async callDeepSeek(prompt: string, options?: any): Promise<string> {
    // 简化实现 - 在实际项目中需要集成真实的 DeepSeek SDK
    logger.debug('Calling DeepSeek API (mock implementation)');
    
    // 模拟API调用
    await this.simulateAPICall();
    
    return `DeepSeek模拟响应: ${prompt.substring(0, 50)}...`;
  }

  /**
   * 调用 Anthropic API
   */
  private async callAnthropic(prompt: string, options?: any): Promise<string> {
    // 简化实现 - 在实际项目中需要集成真实的 Anthropic SDK
    logger.debug('Calling Anthropic API (mock implementation)');
    
    // 模拟API调用
    await this.simulateAPICall();
    
    return `Anthropic模拟响应: ${prompt.substring(0, 50)}...`;
  }

  /**
   * 调用本地模型
   */
  private async callLocal(prompt: string, options?: any): Promise<string> {
    logger.debug('Calling local model (mock implementation)');
    
    // 模拟本地模型调用
    await this.simulateAPICall();
    
    return `本地模型模拟响应: ${prompt.substring(0, 50)}...`;
  }

  /**
   * 模拟API调用延迟
   */
  private async simulateAPICall(): Promise<void> {
    const delay = Math.random() * 1000 + 500; // 500-1500ms
    await new Promise(resolve => setTimeout(resolve, delay));
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
