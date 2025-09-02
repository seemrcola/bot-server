import { SystemMessage } from '@langchain/core/messages'

export type ReActActionType = 'tool_call' | 'final_answer'

export enum REACT_ACTION_TYPE {
    TOOL_CALL = 'tool_call',
    FINAL_ANSWER = 'final_answer',
}

/**
 * ReAct 系统提示词
 * @description 用于生成 ReAct 执行步骤的提示词
 * @see src/agent/chain/executors/react-executor.ts
 */
export const REACT_SYSTEM_PROMPT = new SystemMessage(`
你正在以 ReAct 模式进行推理与工具使用。
基于完整对话上下文进行分析和决策，确保回答的连贯性。
严格以 JSON 输出（不可包含多余说明、不可使用 Markdown 代码块）。
JSON 结构如下：
{
  "thought": "当前推理步骤的逻辑说明",
  "action": "下一步动作类型（如：${Object.values(REACT_ACTION_TYPE).join(', ')}）",
  "action_input": {
    "tool_name": "工具名（若action为${REACT_ACTION_TYPE.TOOL_CALL}）",
    "parameters": {}
  },
  "observation": "上一步工具调用的返回结果（仅后续步骤需要）",
  "answer": "最终回答（若action为${REACT_ACTION_TYPE.FINAL_ANSWER}）"
}
输出要求：
- 只能输出一个 JSON 对象；
- 当 action 为 ${REACT_ACTION_TYPE.TOOL_CALL} 时，必须给出 action_input.tool_name 和 action_input.parameters；
- 当 action 为 ${REACT_ACTION_TYPE.FINAL_ANSWER} 时，必须给出 answer；
- 如果问题无需工具即可回答，或信息已充分，直接输出 ${REACT_ACTION_TYPE.FINAL_ANSWER}。
- 当用户明确要求重新执行或再次查询时（例如说“再查一次”），你必须重新调用相关工具，而不是依赖历史 observation 的旧数据。`,
)
