import { BaseMessage } from "@langchain/core/messages";
import { Agent } from "../agent/agent.js";
import { AgentManager } from "./manager.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger('AgentRouter');

export interface RouteResult {
  name: string;
  agent: Agent;
  reason: string;
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
 * 基于消息内容在已注册的子 Agent 中做一个最小可用的路由：
 * - 若显式指定 agentName，则直接返回对应 agent（若存在）
 * - 否则：若消息文本包含某个子 Agent 的名称（不区分大小写），选择该子 Agent
 * - 否则：回退到 Leader
 */
export function selectAgentForMessages(params: {
  agentManager: AgentManager;
  messages: BaseMessage[];
  agentName?: string | undefined;
}): RouteResult {
  const { agentManager, messages } = params;
  const requested = (params.agentName ?? '').trim();

  // 1) 显式指定优先
  if (requested) {
    const chosen = agentManager.getAgent(requested);
    if (chosen) {
      return { name: requested, agent: chosen, reason: `explicit:${requested}` } as RouteResult;
    }
  }

  // 2) 子 agent 关键词匹配：
  //    - 名称包含（不区分大小写）
  //    - 元信息 keywords/aliases 命中
  const leaderName = agentManager.getLeaderName();
  if (leaderName) {
    const text = getLastHumanText(messages).toLowerCase();
    const subs = agentManager.listSubAgents(leaderName);
    for (const sub of subs) {
      const hitName = text.includes(sub.name.toLowerCase());
      const keywords = sub.meta?.keywords ?? [];
      const aliases = sub.meta?.aliases ?? [];
      const hitKeyword = keywords.some(k => text.includes(k.toLowerCase()));
      const hitAlias = aliases.some(a => text.includes(a.toLowerCase()));
      if (hitName || hitKeyword || hitAlias) {
        const a = agentManager.getAgent(sub.name);
        if (a) {
          logger.info(`路由到子 Agent: ${sub.name}（命中：${hitName ? 'name' : hitKeyword ? 'keyword' : 'alias'}）`);
          return { name: sub.name, agent: a, reason: `name:${sub.name}` } as RouteResult;
        }
      }
    }
  }

  // 3) 回退 Leader
  const leader = agentManager.getLeader();
  if (!leader || !leaderName) {
    throw new Error('未找到可用的 Leader Agent。');
  }
  return { name: leaderName, agent: leader, reason: 'fallback:leader' } as RouteResult;
}


