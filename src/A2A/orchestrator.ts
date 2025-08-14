import { BaseMessage } from "@langchain/core/messages";
import { selectAgentByLLM } from './router.js';
import { AgentChain } from '../agent/index.js';
import { globals } from '../globals.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('A2AOrchestrator');

export interface OrchestratorOptions {
  maxSteps?: number | undefined;              // 最大执行步数，默认8
  reactVerbose?: boolean | undefined;         // 是否输出详细ReAct步骤
  temperature?: number | undefined;           // 采样温度
  agentName?: string | undefined;             // 显式指定要执行的 Agent；通常不指定，由系统进行 LLM 路由
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

  // 显式指定 Agent 优先级最高
  const explicit = (options.agentName ?? '').trim();  // 显式指定要执行的 Agent
  let chosenName: string | undefined;                 // 最终选定的 Agent 名称
  let reason = '';                                    // 选择原因

  // 如果有显式指定，则直接使用
  if (explicit && agentManager.getAgent(explicit)) {
    chosenName = explicit;
    reason = `explicit:${explicit}`;
  } 
  // 否则使用 LLM 路由
  else {
    const [err, data] = await selectAgentByLLM({ agentManager, messages });
    if (err) {
      throw new Error(`route_error: ${err}`);
    }
    chosenName = data!.name;
    reason = `llm:${data!.reason}|confidence:${data!.confidence}`;
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


