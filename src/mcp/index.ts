/**
 * MCP (Model Context Protocol) 模块入口
 * 该文件定义了 MCP 模块的公共接口。
 * 设计原则是，只暴露一个顶层的 `mcp` 对象，该对象封装了所有必要的服务和类型。
 * 外部模块应通过 `mcp.service` 来访问核心功能，并通过 `mcp.types` 来获取类型定义。
 * 这种设计旨在实现高内聚、低耦合，确保模块的独立性和可维护性。
 */
import { mcpService } from './service.js';
import * as mcpTypes from './types/index.js';

// 统一的 MCP 模块导出
const mcp = {
  /**
   * MCP 核心服务，负责模块的生命周期和 Agent 的管理。
   * 外部模块应通过此服务与 MCP 模块交互。
   * @example
   * import { mcp } from './mcp';
   * mcp.service.start(config);
   * const agent = mcp.service.getAgent();
   */
  service: mcpService,
  
  /**
   * MCP 模块的所有公开类型定义。
   * @example
   * import { mcp } from './mcp';
   * let myConfig: mcp.types.MCPAgentConfig;
   */
  types: mcpTypes,
};

export { mcp };
