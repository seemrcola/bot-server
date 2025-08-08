import { BaseMessage } from "@langchain/core/messages";
import { createLogger } from '../../utils/logger.js';
import { globals } from '../../globals.js'; // 从全局容器导入
import { ReActExecutor } from '../../agent/index.js';

const logger = createLogger('ChatService');

class ChatService {
  /**
   * ReAct 模式：多步、多工具的流式聊天链。
   * 默认仅在最终答案时输出；如需步骤轨迹，请在控制器层处理。
   */
  public async runReActStream(
    messages: BaseMessage[],
    options: { maxSteps?: number; agentName?: string } = {}
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

    await agent.ready;

    const executor = new ReActExecutor({ agent });
    return executor.run(messages, { maxSteps: options.maxSteps ?? 8 });
  }
}

// 导出 ChatService 的单例
export const chatService = new ChatService();
