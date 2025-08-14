import { BaseMessage } from "@langchain/core/messages";
import { selectAgentByLLM } from './router.js';
import { AgentChain } from '../agent/index.js';
import { globals } from '../globals.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('A2AOrchestrator');

export interface OrchestratorOptions {
  maxSteps?: number | undefined;
  reactVerbose?: boolean | undefined;
  temperature?: number | undefined;
  agentName?: string | undefined;
}

export async function runWithLeader(
  messages: BaseMessage[],
  options: OrchestratorOptions = {}
): Promise<AsyncIterable<string>> {
  const agentManager = globals.agentManager;
  if (!agentManager) {
    logger.error('AgentManager 未初始化');
    throw new Error('AgentManager 尚未初始化');
  }

  const explicit = (options.agentName ?? '').trim();
  let chosenName: string | undefined;
  let reason = '';

  if (explicit && agentManager.getAgent(explicit)) {
    chosenName = explicit;
    reason = `explicit:${explicit}`;
  } else {
    const llmRoute = await selectAgentByLLM({ agentManager, messages });
    if (llmRoute?.name && agentManager.getAgent(llmRoute.name)) {
      chosenName = llmRoute.name;
      reason = `llm:${llmRoute.reason}|confidence:${llmRoute.confidence}`;
    } else {
      const leaderName = agentManager.getLeaderName();
      const leader = leaderName ? agentManager.getAgent(leaderName) : undefined;
      if (!leader || !leaderName) {
        logger.error('未找到可用的 Leader Agent！');
        throw new Error('未找到可用的 Leader Agent。');
      }
      chosenName = leaderName;
      reason = 'fallback:leader';
    }
  }

  const agent = agentManager.getAgent(chosenName!)!;
  logger.info(`使用 Agent: ${chosenName}（原因: ${reason}）`);

  const chain = new AgentChain(agent);
  const chainOptions: any = {
    maxSteps: options.maxSteps ?? 8,
    reactVerbose: options.reactVerbose ?? false,
  };
  if (typeof options.temperature === 'number') {
    chainOptions.temperature = options.temperature;
  }
  return chain.runChain(messages, chainOptions);
}


