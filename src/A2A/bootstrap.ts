import { Agent } from '../agent/index.js';
import { AgentManager } from './manager.js';
import { createLogger } from '../utils/logger.js';
import { ChatDeepSeek } from '@langchain/deepseek';
import { ChatAlibabaTongyi } from "@langchain/community/chat_models/alibaba_tongyi";
// leader 模块 和 dashboard 模块
import leader from './Leader/index.js';
import { dashboards } from './Dashboard/index.js';

import type { MCPServerDescription } from './types.js';

const logger = createLogger('A2ABootstrap');

const defaultSystemPrompt = `
你是一个乐于助人的 AI 助手。回复内容请使用 Markdown 格式。`
;

const modelMap = {
  'qwen': ChatAlibabaTongyi,
  'deepseek': ChatDeepSeek,
}

function createLLM() {
  return new modelMap['qwen']({
    model: process.env['LLM_MODEL'] || '',
    alibabaApiKey  : process.env['LLM_API_KEY'] || '',
    temperature: 0.7,
    streaming: true,
  });
}


 
export async function initLeaderA2A(externalMCPServers: MCPServerDescription[]): Promise<AgentManager> {
  const systemPrompt = defaultSystemPrompt;

  // 1) 启动 Leader 的外部 MCP 工具服务
  const leaderServers = await leader.starter();

  // 2) 创建 LLM 与 Leader Agent
  const llm = createLLM();
  const mainAgent = new Agent(
    llm, 
    [...leaderServers, ...externalMCPServers], 
    systemPrompt
  );
  await mainAgent.ready;

  // 3) 注册到 AgentManager
  const agentManager = new AgentManager();
  agentManager.registerLeader(leader.name, mainAgent, leader.agentDescription, { keywords: ['leader', 'default'] });
  logger.info(`Leader 已初始化并注册: ${leader.name}`);

  // 4) 使用集中导出的 dashboards 列表，逐个注册为 Leader 的子 Agent
  for (const dashboard of dashboards) {
    try {
      if (!dashboard?.name || typeof dashboard?.starter !== 'function') {
        logger.warn('子 Agent 模块结构不符合要求，已跳过');
        continue;
      }
      const subServers = await dashboard.starter();

      const subAgent = new Agent(
          createLLM(), 
          subServers, 
          `你是 ${dashboard.name} 的专属 Agent，用于处理该域问题。`
      );
      await subAgent.ready;
      agentManager.registerSubAgent(
        leader.name,                       // 父 Agent 名称
        dashboard.name,                    // 子 Agent 名称
        subAgent,                          // 子 Agent 实例
        dashboard.agentDescription || '',  // 子 Agent 描述
        {                                  // 子 Agent 元数据
          keywords: [dashboard.name],
          aliases: [dashboard.name.replace(/-agent$/i, '')]
        }
      );
      logger.info(`子 Agent 已初始化并注册: ${dashboard.name}`);
    } catch (e) {
      logger.warn(`注册子 Agent 失败：${dashboard?.name ?? 'unknown'}`, e);
    }
  }

  return agentManager;
}


