import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage } from "@langchain/core/messages";

/**
 * QuietChatOpenAI
 * - 目的：避免在使用非 tiktoken 映射模型名时打印“Failed to calculate number of tokens...”日志。
 * - 做法：覆盖本地 token 预估方法，改用简易近似（字符数/4），不触发 tiktoken 的 encodingForModel。
 * - 注意：仅影响本地统计，不影响实际请求与服务端计费。
 */
export class QuietChatOpenAI extends ChatOpenAI {
  public override async getNumTokens(text: string): Promise<number> {
    const s = typeof text === "string" ? text : String(text ?? "");
    return Math.ceil(s.length / 4);
  }

  public override async getNumTokensFromMessages(messages: BaseMessage[]): Promise<{ totalCount: number; countPerMessage: number[] }> {
    try {
      const counts = (messages ?? []).map((m) => Math.ceil(String((m as any)?.content ?? "").length / 4));
      const total = counts.reduce((a, b) => a + b, 0);
      return { totalCount: total, countPerMessage: counts };
    } catch {
      return { totalCount: 0, countPerMessage: [] };
    }
  }

  // 注意：父类的 getEstimatedTokenCountFromPrompt 是 private，无法覆盖；
  // 但我们已经覆盖了公开的 getNumTokens / getNumTokensFromMessages，足以避免 tiktoken 调用。
  // https://github.com/langchain-ai/langchain/issues/8675
}

