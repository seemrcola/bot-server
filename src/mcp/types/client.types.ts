/**
 * MCP Client 相关类型定义
 */

import { ToolParameters, ToolResult, ToolInfo } from "./agent.types.js";

// ==================== MCP客户端接口 ====================

export interface IMCPClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  callTool(toolName: string, parameters: ToolParameters): Promise<ToolResult>;
  listTools(): Promise<ToolInfo[]>;
  getToolInfo(toolName: string): ToolInfo | undefined;
  isConnected(): boolean;
}

// ==================== 客户端配置 ====================

export interface MCPClientConfig {
  serverUrl: string;
  timeout: number;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  enableHeartbeat?: boolean;
  heartbeatInterval?: number;
}

// ==================== 连接状态 ====================

export interface ConnectionStatus {
  connected: boolean;
  lastConnected?: Date;
  lastDisconnected?: Date;
  reconnectAttempts: number;
  error?: string;
}

// ==================== 客户端事件 ====================

export interface ClientEvents {
  connected: () => void;
  disconnected: (reason?: string) => void;
  error: (error: Error) => void;
  toolResult: (result: ToolResult) => void;
}

// 类型别名，用于配置中心
export type ClientConfig = MCPClientConfig;
