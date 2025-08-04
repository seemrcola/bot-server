/**
 * @file prompts/manager.ts
 * @description 提示词管理器，负责加载和提供系统提示词
 */

import { IPromptManager, PromptCollection, PromptKey } from '../types/prompts.types.js';
import { defaultPrompts } from './default.js';
import { createMCPLogger } from '../utils/logger.js';

const logger = createMCPLogger('PromptManager');

export class PromptManager implements IPromptManager {
  private static instance: PromptManager;
  private prompts: PromptCollection;

  private constructor() {
    this.prompts = { ...defaultPrompts };
    logger.info('PromptManager initialized with default prompts.');
  }

  public static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    return PromptManager.instance;
  }

  public loadPrompts(prompts: Partial<PromptCollection>): void {
    // 使用传入的提示词覆盖默认值
    // Object.assign会修改第一个参数，所以我们传一个新对象
    this.prompts = Object.assign({}, this.prompts, prompts);
    logger.info('Custom prompts loaded and merged.');
  }

  public getPrompt(key: PromptKey): string {
    const prompt = this.prompts[key];
    if (!prompt) {
      logger.error(`Prompt with key "${key}" not found.`);
      throw new Error(`Prompt with key "${key}" not found.`);
    }
    return prompt;
  }

  /**
   * 获取所有提示词，主要用于调试或管理界面
   */
  public getAllPrompts(): PromptCollection {
    return { ...this.prompts };
  }
}

export const promptManager = PromptManager.getInstance();
