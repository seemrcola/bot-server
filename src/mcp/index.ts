/**
 * MCP (Model Context Protocol) 模块入口
 */

// Core components
export { MCPAgent } from './agent/mcp-agent.js';
export { MCPClient } from './client/mcp-client.js';
export { MCPServer } from './servers/default/mcp-server.js';
export { ServerManager } from './servers/manager.js';
export { ToolRegistry } from './servers/tool-registry.js';

// LLM components
export { LLMNLPProcessor, LLMConfigManager } from './llm/index.js';

// Configuration
export { 
  getConfig, 
  getConfigCenter,
  createAgentConfigProxy,
  createClientConfigProxy,
  createLLMConfigProxy
} from './config/index.js';

// Types
export type {
  IMCPAgent,
  IMCPClient,
  IMCPServer,
  ITool,
  MCPResponse,
  ChatContext,
  ToolResult,
  ToolParameters,
  ToolInfo,
  MCPAgentConfig,
  LLMConfig,
  MCPClientConfig,
  MCPServerConfig,
  ToolsConfig,
  NLPConfig,
  LoggingConfig,
  ToolConfig,
  ToolParameterSchema,
  AnalysisResult,
  INLProcessor,
  ILLMService,
  LLMMetrics
} from './types/index.js';

// Utilities
export { MCPError, MCPErrorCode } from './utils/errors.js';
export { createMCPLogger } from './utils/logger.js';
