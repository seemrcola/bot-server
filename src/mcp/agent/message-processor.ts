/**
 * MCP消息处理器
 * 负责处理MCP客户端和服务端之间的消息交换
 */

import { ToolParameters, ToolResult } from '../types/index.js';
import { MCPError } from '../utils/errors.js';
import { createMCPLogger } from '../utils/logger.js';

const logger = createMCPLogger('MessageProcessor');

export interface MCPMessage {
  id: string;
  type: MCPMessageType;
  payload: any;
  timestamp: number;
}

export enum MCPMessageType {
  PING = 'PING',
  PONG = 'PONG',
  TOOL_CALL = 'TOOL_CALL',
  TOOL_RESULT = 'TOOL_RESULT',
  LIST_TOOLS = 'LIST_TOOLS',
  TOOLS_LIST = 'TOOLS_LIST',
  ERROR = 'ERROR',
  REGISTER_TOOL = 'REGISTER_TOOL',
  UNREGISTER_TOOL = 'UNREGISTER_TOOL',
  REGISTRATION_RESULT = 'REGISTRATION_RESULT'
}

export interface ToolCallMessage {
  toolName: string;
  parameters: ToolParameters;
  timeout?: number;
}

export interface ToolResultMessage {
  toolName: string;
  result: ToolResult;
}

export interface ErrorMessage {
  code: string;
  message: string;
  details?: any;
}

export class MessageProcessor {
  /**
   * 生成唯一消息ID
   */
  static generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 创建工具调用消息
   */
  static createToolCallMessage(toolName: string, parameters: ToolParameters, timeout?: number): MCPMessage {
    return {
      id: this.generateMessageId(),
      type: MCPMessageType.TOOL_CALL,
      payload: {
        toolName,
        parameters,
        timeout
      } as ToolCallMessage,
      timestamp: Date.now()
    };
  }

  /**
   * 创建工具结果消息
   */
  static createToolResultMessage(toolName: string, result: ToolResult, requestId: string): MCPMessage {
    return {
      id: requestId,
      type: MCPMessageType.TOOL_RESULT,
      payload: {
        toolName,
        result
      } as ToolResultMessage,
      timestamp: Date.now()
    };
  }

  /**
   * 创建错误消息
   */
  static createErrorMessage(error: any, requestId: string): MCPMessage {
    return {
      id: requestId,
      type: MCPMessageType.ERROR,
      payload: {
        code: error instanceof MCPError ? error.code : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        details: error.details || null,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * 创建工具列表请求消息
   */
  static createListToolsMessage(): MCPMessage {
    return {
      id: this.generateMessageId(),
      type: MCPMessageType.LIST_TOOLS,
      payload: {},
      timestamp: Date.now()
    };
  }

  /**
   * 创建工具列表响应消息
   */
  static createToolsListMessage(tools: any[], requestId: string): MCPMessage {
    return {
      id: requestId,
      type: MCPMessageType.TOOLS_LIST,
      payload: { tools },
      timestamp: Date.now()
    };
  }

  /**
   * 创建Ping消息
   */
  static createPingMessage(): MCPMessage {
    return {
      id: this.generateMessageId(),
      type: MCPMessageType.PING,
      payload: { timestamp: Date.now() },
      timestamp: Date.now()
    };
  }

  /**
   * 创建Pong消息
   */
  static createPongMessage(pingId: string): MCPMessage {
    return {
      id: pingId,
      type: MCPMessageType.PONG,
      payload: { timestamp: Date.now() },
      timestamp: Date.now()
    };
  }

  /**
   * 解析消息
   */
  static parseMessage(data: string): MCPMessage {
    try {
      const message = JSON.parse(data);
      
      if (!message.id || !message.type) {
        throw new Error('Invalid message format: missing id or type');
      }
      
      return message;
    } catch (error) {
      logger.error('Failed to parse message', error);
      throw MCPError.executionError('消息解析失败', error);
    }
  }

  /**
   * 序列化消息
   */
  static serializeMessage(message: MCPMessage): string {
    try {
      return JSON.stringify(message);
    } catch (error) {
      logger.error('Failed to serialize message', error);
      throw MCPError.executionError('消息序列化失败', error);
    }
  }

  /**
   * 验证消息格式
   */
  static validateMessage(message: MCPMessage): boolean {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (!message.id || typeof message.id !== 'string') {
      return false;
    }

    if (!message.type || !Object.values(MCPMessageType).includes(message.type)) {
      return false;
    }

    if (!message.timestamp || typeof message.timestamp !== 'number') {
      return false;
    }

    if (message.payload === undefined) {
      return false;
    }

    return true;
  }
}
