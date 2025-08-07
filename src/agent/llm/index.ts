import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { Runnable } from "@langchain/core/runnables";

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
 * 将工具列表绑定到给定的语言模型，并返回一个可执行的 Runnable 实例。
 * 这个函数封装了与特定模型功能（如 .bindTools）相关的逻辑。
 * @param llm - 一个基础语言模型实例。
 * @param tools - 一个符合 LangChain/AI SDK 格式的工具数组。
 * @returns 返回一个绑定了工具的 Runnable 实例。如果模型不支持工具调用，则返回原始模型。
 */
export function createToolCallingExecutor(
  llm: BaseLanguageModel,
  tools: any[]
): Runnable {
  // 首先，使用类型守卫检查模型是否支持 .bindTools
  if (isToolCallingModel(llm) && tools.length > 0) {
    // 现在知道 llm 上有一个可调用的 bindTools 方法
    return llm.bindTools(tools);
  }
  
  // 如果模型不支持工具调用或没有工具，则返回原始的 llm 实例
  return llm;
}
