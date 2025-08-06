/**
 * Agent 模块专属配置接口定义
 */

/**
 * 定义大语言模型 (LLM) 的配置结构。
 */
export interface LLMConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}
