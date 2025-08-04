/**
 * MCP Server 相关类型定义
 */

import type { ITool, ToolInfo } from './agent.types.js';

// 重新导出统一的ITool接口
export type { ITool, ToolResult, ToolParameters, ToolInfo } from './agent.types.js';

// ==================== MCP服务端接口 ====================

export interface IMCPServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  registerTool(tool: ITool): void;
  unregisterTool(toolName: string): void;
  getRegisteredTools(): ToolInfo[];
  getOptions(): any; // 添加 getOptions 方法
}

// ==================== 服务端配置 ====================

export interface MCPServerConfig {
  port: number;
  host: string;
  enableCors?: boolean;
  corsOrigins?: string[];
  enableLogging?: boolean;
  maxConnections?: number;
}

// ==================== 服务端状态 ====================

export interface ServerStatus {
  running: boolean;
  startTime?: Date;
  connections: number;
  registeredTools: number;
  totalRequests: number;
  errors: number;
}

// ==================== 服务端事件 ====================

export interface ServerEvents {
  started: () => void;
  stopped: () => void;
  clientConnected: (clientId: string) => void;
  clientDisconnected: (clientId: string) => void;
  toolRegistered: (toolName: string) => void;
  toolUnregistered: (toolName: string) => void;
  error: (error: Error) => void;
}

// 类型别名，用于配置中心
export type ServerConfig = MCPServerConfig;
