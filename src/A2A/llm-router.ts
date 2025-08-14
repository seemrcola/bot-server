import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { AgentManager } from "./manager.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger('LLMAgentRouter');

export interface LLMRouteResult {
  name: string;
  reason: string;
  confidence: number;
}

function getLastHumanText(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m: any = messages[i];
    const type = typeof m?.getType === 'function' ? m.getType() : m?._type ?? m?.type;
    if (type === 'human') {
      const content = (m?.content ?? '') as any;
      return typeof content === 'string' ? content : String(content ?? '');
    }
  }
  return '';
}

/**
 * 使用 LLM 进行“精准路由”：在已注册的子 Agent 与 Leader 之间选择最合适的 Agent。
 * 仅输出一个 JSON：{ target: string; reason: string; confidence: number }
 */
export async function selectAgentByLLM(params: {
  agentManager: AgentManager;
  messages: BaseMessage[];
  threshold?: number;
}): Promise<LLMRouteResult> {
  const { agentManager } = params;
  const threshold = typeof params.threshold === 'number' ? params.threshold : 0.5;

  const leaderName = agentManager.getLeaderName();
  const leader = agentManager.getLeader();
  if (!leader || !leaderName) {
    throw new Error('未找到可用的 Leader Agent。');
  }

  // 收集候选子 Agent 列表
  const subs = agentManager.listSubAgents(leaderName);
  const catalog = subs.map(s => ({
    name: s.name,
    description: s.description || '',
    keywords: s.meta?.keywords || [],
    aliases: s.meta?.aliases || [],
  }));

  const userText = getLastHumanText(params.messages);

  const sys = new SystemMessage([
    '你是一个路由器。你的任务：根据用户的最后一条需求文本，在候选 Agent 中选择最合适的一个来处理。',
    '候选列表包含名称、简介、关键词、别名。',
    '必须只输出一个 JSON 对象，不要额外文本或代码块。',
    '{',
    '  "target": "agent-name 或 leader-agent",',
    '  "reason": "简述选择原因",',
    '  "confidence": 0.0 到 1.0 之间的数值',
    '}',
    '选择规则：',
    '- 若用户需求与某个子 Agent 的名称/关键词/别名强相关，则选该子 Agent；',
    '- 否则选择 leader-agent 作为兜底。',
  ].join('\n'));

  const human = new HumanMessage([
    '用户最后一条消息：',
    JSON.stringify(userText),
    '\n\n候选子 Agent 列表：',
    JSON.stringify(catalog, null, 2),
    '\n\nLeader 名称：',
    leaderName,
    '\n\n请输出 JSON：',
  ].join(''));

  let raw: any;
  try {
    raw = await leader.languageModel.invoke([sys, human]);
  } catch (e) {
    logger.warn('LLM 路由调用失败，回退 Leader。', e);
    return { name: leaderName, reason: 'fallback:invoke_error', confidence: 0 };
  }

  const text = String((raw as any)?.content ?? '').trim();
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    const slice = start >= 0 && end >= start ? text.slice(start, end + 1) : text;
    const obj = JSON.parse(slice) as { target?: string; reason?: string; confidence?: number };
    const target = (obj.target || '').trim();
    const reason = typeof obj.reason === 'string' ? obj.reason : '';
    const confidence = typeof obj.confidence === 'number' ? obj.confidence : 0;

    // 置信度检查与存在性检查
    if (!target) return { name: leaderName, reason: 'fallback:empty_target', confidence: 0 };
    const targetExists = target === leaderName || !!agentManager.getAgent(target);
    if (!targetExists || confidence < threshold) {
      return { name: leaderName, reason: 'fallback:low_confidence_or_not_found', confidence };
    }
    return { name: target, reason: reason || 'llm', confidence };
  } catch (e) {
    logger.warn('LLM 路由结果解析失败，回退 Leader。', e);
    return { name: leaderName, reason: 'fallback:parse_error', confidence: 0 };
  }
}


