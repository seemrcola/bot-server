import { BaseMessage } from "@langchain/core/messages";
import { createLogger } from '../../utils/logger.js';
import { globals } from '../../globals.js'; // 从全局容器导入
import { runWithLeader } from '../../A2A/orchestrator.js';

const logger = createLogger('ChatService');

async function ensureBootstrap(): Promise<void> {
  if (globals.agentManager) return;
  if (globals.agentManagerReady) {
    await globals.agentManagerReady;
    return;
  }
  throw new Error('AgentManager 尚未初始化（缺少全局就绪 Promise）。');
}

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
    await ensureBootstrap();
    const agentManager = globals.agentManager;
    if (!agentManager) {
      logger.error("严重错误: AgentManager 未初始化！");
      throw new Error("AgentManager 尚未初始化，无法处理聊天请求。");
    }
    // 路由选择：优先显式指定；否则仅使用 LLM 精准路由；不命中则回退 Leader
    return runWithLeader(messages, {
      maxSteps: options.maxSteps,
      reactVerbose: options.reactVerbose,
      temperature: options.temperature,
      agentName: options.agentName,
    });
  }

}

// 导出 ChatService 的单例
export const chatService = new ChatService();
