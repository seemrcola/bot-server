import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ClientManager } from "../mcp/client/manager.js";
import { createLogger } from "../utils/logger.js";
import { Agent } from "../agent.js";

const logger = createLogger("FunctionReActExecutor");
const MAX_STEPS = 8;

export interface ReActExecutorOptions {
  maxSteps?: number;
}

export interface ExternalToolSpec {
  name: string;
  description?: string;
  schema?: unknown;
}

export class FunctionReActExecutor {
  private readonly llm: BaseLanguageModel;
  private readonly clientManager: ClientManager;
  private readonly systemPrompt: string;
  private readonly agent: Agent;

  constructor(params: { agent: Agent }) {
    this.agent = params.agent;
    this.llm = this.agent.languageModel;
    this.clientManager = this.agent.clientManager;
    this.systemPrompt = this.agent.systemPromptValue;
  }

  public async *run(
    messages: BaseMessage[],
    options: ReActExecutorOptions = {}
  ): AsyncIterable<string> {
    const maxSteps = options.maxSteps ?? MAX_STEPS;

    const dynamicMessages: BaseMessage[] = [
      new SystemMessage(this.systemPrompt),
      ...messages,
    ];

    for (let i = 0; i < maxSteps; i++) {
      // 1) 绑定工具
      const availableTools = await this.clientManager.getAllTools();
      const toolSpecs: ExternalToolSpec[] = availableTools.map((t) => ({
        name: t.name,
        description: t.description ?? "",
        schema: t.inputSchema ?? {},
      }));

      const modelWithTools: any = typeof (this.llm as any)?.bindTools === 'function'
        ? (this.llm as any).bindTools(toolSpecs as any)
        : this.llm;

      // 2) 调用模型
      let ai: any;
      try {
        ai = await modelWithTools.invoke(dynamicMessages);
      } catch (err) {
        const step = {
          thought: "LLM 调用失败，准备终止。",
          action: "final_answer",
          answer: `LLM 调用失败: ${err instanceof Error ? err.message : String(err)}`,
        };
        yield JSON.stringify(step);
        return;
      }

      // 3) 解析 tool_calls
      const toolCalls: any[] = ai?.tool_calls
        ?? ai?.additional_kwargs?.tool_calls
        ?? [];

      if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        for (const call of toolCalls) {
          const name: string = call?.name || call?.function?.name || "";
          let args: Record<string, unknown> = {};
          try {
            args = call?.args || (call?.function?.arguments ? JSON.parse(call.function.arguments) : {});
          } catch {}

          const step: any = {
            thought: "模型请求调用工具。",
            action: "tool_call",
            action_input: { tool_name: name, parameters: args },
          };
          yield JSON.stringify(step);

          try {
            const result = await this.clientManager.callTool(name, args);
            const observation = extractDisplayableTextFromToolResult(result);
            step.observation = observation;
            yield JSON.stringify(step);

            // 将观测回灌到对话，帮助下一轮决策
            dynamicMessages.push(new HumanMessage(`工具 ${name} 返回：${observation}`));
          } catch (err) {
            const observation = `工具调用失败: ${err instanceof Error ? err.message : String(err)}`;
            step.observation = observation;
            yield JSON.stringify(step);
            dynamicMessages.push(new HumanMessage(observation));
          }
        }
        // 继续下一轮
        continue;
      }

      // 4) 无 tool_calls，则视为最终答案
      const answerText = extractText(ai?.content);
      const finalStep = {
        thought: "已得到最终答案。",
        action: "final_answer",
        answer: answerText,
      };
      yield JSON.stringify(finalStep);
      return;
    }

    // 达到步数上限
    const timeoutStep = {
      thought: "达到最大推理步数，返回当前最优答案。",
      action: "final_answer",
      answer: "未能在限定步数内得到明确答案。",
    };
    yield JSON.stringify(timeoutStep);
  }
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c) => String((c as any)?.text ?? "")).join("");
  if (content && typeof content === "object" && (content as any).type === "text") {
    return String((content as any).text ?? "");
  }
  return String(content ?? "");
}

function extractDisplayableTextFromToolResult(toolResult: any): string {
  const resultContent: unknown = toolResult?.content;
  if (Array.isArray(resultContent)) {
    const texts: string[] = [];
    for (const part of resultContent) {
      if (part && typeof part === "object" && (part as any).type === "text" && typeof (part as any).text === "string") {
        texts.push((part as any).text);
      }
    }
    return texts.length > 0 ? texts.join("") : "工具未返回可显示的文本结果。";
  } else if (typeof resultContent === "string") {
    return resultContent;
  }
  return "工具未返回可显示的文本结果。";
}

