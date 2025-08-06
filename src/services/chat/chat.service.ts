import { BaseMessage } from "@langchain/core/messages";
import { createLogger } from '../../utils/logger.js';
import { globals } from '../../globals.js'; // 从全局容器导入

const logger = createLogger('ChatService');

class ChatService {

  /**
   * 运行一个支持对话历史和Agent工具调用的流式聊天链。
   */
  public async runChatStream(messages: BaseMessage[], sessionId?: string): Promise<AsyncIterable<string>> {
    const agent = globals.agent; // 从全局容器获取 agent 实例
    
    if (!agent) {
      // 这是一个严重错误，说明 Agent 没有在服务启动时被正确初始化
      logger.error("严重错误: Agent 实例未初始化！");
      throw new Error("Agent 尚未初始化，无法处理聊天请求。");
    }
    
    logger.info('将消息路由到 Agent 处理...');
    return agent.processMessageStream(messages, sessionId);
  }
}

// 导出 ChatService 的单例
export const chatService = new ChatService();
