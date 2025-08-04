/**
 * @file prompts/types.ts
 * @description 提示词模块的类型定义
 */

/**
 * 提示词的唯一标识符
 */
export type PromptKey =
  | 'intent_analysis'
  | 'simple_task'
  | 'final_response'
  | 'tool_error';

/**
 * 存储所有提示词模板的集合
 */
export type PromptCollection = Record<PromptKey, string>;

/**
 * 提示词管理器接口
 */
export interface IPromptManager {
  /**
   * 获取指定键的提示词模板
   * @param key 提示词的键
   * @returns 提示词模板字符串
   * @throws 如果找不到提示词，则抛出错误
   */
  getPrompt(key: PromptKey): string;

  /**
   * 加载并设置提示词集合
   * @param prompts 提示词集合
   */
  loadPrompts(prompts: Partial<PromptCollection>): void;
}
