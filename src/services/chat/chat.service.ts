import { BaseMessage } from "@langchain/core/messages";
import { createLogger } from '../../utils/logger.js';
import { globals } from '../../globals.js'; // 从全局容器导入

const logger = createLogger('ChatService');

class ChatService {

  /**
   * 运行一个支持对话历史和Agent工具调用的流式聊天链。
   */
  public async runChatStream(messages: BaseMessage[], sessionId?: string): Promise<AsyncIterable<string>> {
    // 从全局容器获取 agent 实例
    const agent = globals.agent; 
    
    if (!agent) {
      logger.error("严重错误: Agent 实例未初始化！");
      throw new Error("Agent 尚未初始化，无法处理聊天请求。");
    }
    
    // 等待 Agent 的外部服务初始化完成，避免首次请求时工具尚未就绪
    await agent.ready;

    logger.info('将消息路由到 Agent 处理...');
    return agent.processMessageStream(messages, sessionId);
  }
}

// 导出 ChatService 的单例
export const chatService = new ChatService();
