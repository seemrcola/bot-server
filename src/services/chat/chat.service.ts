import { BaseMessage } from "@langchain/core/messages";
import { createLogger } from '../../utils/logger.js';
import { globals } from '../../globals.js'; // 从全局容器导入
import { AgentChain } from '../../agent/index.js';
import type { AppConfig } from '../../config/index.js';

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
      strategy?: AppConfig['reactStrategy'];
      reactVerbose?: boolean;
      temperature?: number;
    }
  ): Promise<AsyncIterable<string>> {
    const agentName = options.agentName || 'main-agent';

    const agentManager = globals.agentManager;
    if (!agentManager) {
      logger.error("严重错误: AgentManager 未初始化！");
      throw new Error("AgentManager 尚未初始化，无法处理聊天请求。");
    }
    const agent = agentManager.getAgent(agentName);
    if (!agent) {
      logger.error(`未找到名为 ${agentName} 的 Agent！`);
      throw new Error(`未找到名为 ${agentName} 的 Agent。`);
    }

    // 创建AgentChain并执行
    const chain = new AgentChain(agent);
    const chainOptions: any = {
      maxSteps: options.maxSteps ?? 8,
      reactVerbose: options.reactVerbose ?? false
    };
    if (options.strategy) {
      chainOptions.strategy = options.strategy;
    }
    if (typeof options.temperature === 'number') {
      chainOptions.temperature = options.temperature;
    }
    return chain.runChain(messages, chainOptions);
  }

}

// 导出 ChatService 的单例
export const chatService = new ChatService();
