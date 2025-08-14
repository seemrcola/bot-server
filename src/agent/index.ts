/**
 * Agent 模块的统一出口。
 * 外部应用应通过此文件导入 Agent 相关的类和接口。
 */

// 导出 Agent 相关的类和接口
export { Agent } from './agent.js';
// 导出 MCP 相关的类和接口
export { MCPServer } from './mcp/server/index.js';
// 导出 MCP 相关的类型
export type { ExternalServerConfig } from './mcp/client/manager.js';
// 导出 ReAct 执行器（Prompt 模式）
export { PromptReActExecutor } from './executors/promptBaseToolUse.ReAct.js';
// 导出 Agent 链式处理
export { AgentChain } from './chain/index.js';
