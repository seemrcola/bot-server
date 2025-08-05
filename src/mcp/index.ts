/**
 * MCP (Model Context Protocol) 模块入口
 * 该文件定义了 MCP 模块的公共接口。
 * 设计原则是，只暴露一个顶层的 `mcp` 对象，该对象封装了所有必要的服务和类型。
 * 外部模块应通过 `mcp.service` 来访问核心功能，并通过 `mcp.types` 来获取类型定义。
 * 这种设计旨在实现高内聚、低耦合，确保模块的独立性和可维护性。
 */
import { mcpService } from './service.js';
import * as mcpTypes from './types/index.js';
import * as mcpUtils from './utils/index.js';
import { promptManager } from './prompts/manager.js';
import { resourceManager } from './resources/manager.js';
import type { MCPService } from './service.js';
import type { PromptManager } from './prompts/manager.js';
import type { ResourceManager } from './resources/manager.js';

// 统一的 MCP 模块导出
const mcp: {
  service: MCPService;
  prompts: PromptManager;
  resources: ResourceManager;
  types: typeof mcpTypes;
  utils: typeof mcpUtils;
} = {
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
   * 提示词管理器，负责加载和提供系统提示词。
   * @example
   * import { mcp } from './mcp';
   * const prompt = mcp.prompts.getPrompt('intent_analysis');
   */
  prompts: promptManager,

  /**
   * 资源管理器，负责加载和提供外部资源。
   * @example
   * import { mcp } from './mcp';
   * const fileContent = await mcp.resources.getResource('file://./my-data.txt');
   */
  resources: resourceManager,
  
  /**
   * MCP 模块的所有公开类型定义。
   * @example
   * import { mcp } from './mcp';
   * let myConfig: mcp.types.MCPAgentConfig;
   */
  types: mcpTypes,

  /**
   * MCP 模块的公共工具函数。
   * @example
   * import { mcp } from './mcp';
   * const logger = mcp.utils.createMCPLogger('MyModule');
   */
  utils: mcpUtils,
};

export { mcp };
