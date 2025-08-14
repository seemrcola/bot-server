import { BaseMessage } from "@langchain/core/messages";
import { createLogger } from '../../utils/logger.js';
import { globals } from '../../globals.js'; // 从全局容器导入
import { AgentChain } from '../../agent/index.js';
import { selectAgentForMessages } from '../../A2A/router.js';
import { selectAgentByLLM } from '../../A2A/llm-router.js';

const logger = createLogger('ChatService');

class ChatService {
  /**
   * 基于Agent链式处理的流式聊天：
   * 1) 意图分析 - 判断是否需要使用工具
   * 2) 执行 - 根据意图选择直接LLM回答或ReAct模式  
   * 3) 增强回复 - 对ReAct结果进行增强处理
   */
  public async runChainStream(
    messages: BaseMessage[],
    options: { 
      maxSteps?: number; 
      agentName?: string; 
      reactVerbose?: boolean;
      temperature?: number;
    }
  ): Promise<AsyncIterable<string>> {
    const agentManager = globals.agentManager;
    if (!agentManager) {
      logger.error("严重错误: AgentManager 未初始化！");
      throw new Error("AgentManager 尚未初始化，无法处理聊天请求。");
    }
    // 路由选择：优先显式指定；否则 LLM 精准路由；仍未命中再做名称/关键词回退
    const explicit = (options.agentName ?? '').trim();
    let chosenName: string | undefined;
    let reason: string = '';
    if (explicit && agentManager.getAgent(explicit)) {
      chosenName = explicit;
      reason = `explicit:${explicit}`;
    } else {
      const llmRoute = await selectAgentByLLM({ agentManager, messages });
      if (llmRoute?.name && agentManager.getAgent(llmRoute.name)) {
        chosenName = llmRoute.name;
        reason = `llm:${llmRoute.reason}|confidence:${llmRoute.confidence}`;
      } else {
        const fallback = selectAgentForMessages({ agentManager, messages });
        chosenName = fallback.name;
        reason = `fallback:${fallback.reason}`;
      }
    }
    const agent = agentManager.getAgent(chosenName!)!;
    logger.info(`使用 Agent: ${chosenName}（原因: ${reason}）`);

    // 创建AgentChain并执行
    const chain = new AgentChain(agent);
    const chainOptions: any = {
      maxSteps: options.maxSteps ?? 8,
      reactVerbose: options.reactVerbose ?? false
    };
    if (typeof options.temperature === 'number') {
      chainOptions.temperature = options.temperature;
    }
    return chain.runChain(messages, chainOptions);
  }

}

// 导出 ChatService 的单例
export const chatService = new ChatService();
