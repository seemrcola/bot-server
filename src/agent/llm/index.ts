import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { Runnable } from "@langchain/core/runnables";
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('LLM');

/**
 * 检查给定的 LLM 是否是支持工具调用的模型。
 * 这是一个类型守卫，通过检查 .bindTools 方法的存在来安全地确定模型的能力。
 * @param llm - 要检查的语言模型。
 * @returns 如果模型支持 .bindTools，则返回 true。
 */
function isToolCallingModel(llm: any): llm is { bindTools: (tools: any[]) => Runnable } {
  return typeof llm.bindTools === 'function';
}

/**
 * 创建一个“武装了工具”的可执行实例 (Runnable)。
 * 
 * @description
 * 这个函数是 Agent 与 LLM 特定功能（如工具调用）之间的核心“适配器”。
 * 它接收一个通用的 `BaseLanguageModel`，并安全地检查它是否具备 `.bindTools` 这一高级功能。
 * 这么做的核心设计目的是：
 *   1. **保持 Agent 通用性**: `Agent` 类本身不需要知道任何关于 `bindTools` 的细节，
 *      它依赖的 `llm` 属性类型依旧是宽泛的 `BaseLanguageModel`。
 *   2. **封装特定逻辑**: 所有与“如何让模型支持工具调用”相关的逻辑都被封装在这个函数中，
 *      遵循了“关注点分离”的原则。如果未来 LangChain 或模型厂商的 API 发生变化，
 *      我们很可能只需要修改这里，而不用触及 `Agent` 的核心代码。
 * 
 * @param llm - 一个基础语言模型实例。它可以是任何继承自 `BaseLanguageModel` 的模型。
 * @param tools - 一个数组，包含了所有希望绑定到模型的工具。每个工具对象需要符合 
 *                LangChain/AI SDK 期望的格式，通常是 `{ name, description, schema }`。
 * 
 * @returns {Runnable} - 返回一个可执行的 `Runnable` 实例。
 *   - 如果传入的 `llm` 支持工具调用（即拥有 `.bindTools` 方法）并且 `tools` 数组不为空，
 *     则返回一个被“武装”了这些工具的新 `Runnable`。
 *   - 否则，原封不动地返回原始的 `llm` 实例，它本身也是一个 `Runnable`。
 */
export function createToolCallingExecutor(
  llm: BaseLanguageModel,
  tools: any[]
): Runnable {
  // 首先，使用类型守卫检查模型是否支持 .bindTools
  if (isToolCallingModel(llm) && tools.length > 0) {
    logger.info('模型支持工具调用，正在绑定工具...');
    return llm.bindTools(tools);
  }
  
  logger.info('模型不支持工具调用或无工具可绑定，返回原始LLM。');
  return llm;
}
