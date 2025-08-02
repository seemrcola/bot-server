/**
 * MCP 统一服务
 * 负责管理 MCP 模块的生命周期和提供 Agent 的单例
 */
import { MCPAgent } from './agent/mcp-agent.js';
import { MCPAgentConfig } from './types/index.js';
import { initializeMCPLogger } from './adapters/logger-adapter.js';
import { createMCPLogger } from './utils/logger.js';
import { getConfig, validateConfig } from './config/index.js';

const logger = createMCPLogger('MCPService');

export class MCPService {
  private static instance: MCPService;
  private agent: MCPAgent | undefined;

  private constructor() {
    // 私有构造函数，确保单例模式
  }

  public static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService();
    }
    return MCPService.instance;
  }

  /**
   * 启动并初始化整个 MCP 模块
   * @param config 可选的外部配置，将与默认配置合并
   */
  async start(config?: Partial<MCPAgentConfig>): Promise<void> {
    if (this.agent) {
      logger.info('MCPService has already been started.');
      return;
    }

    logger.info('Starting MCPService...');

    // 1. 初始化日志系统
    // mcp 模块应该可以自给自足，但允许外部注入更强大的 logger
    // 这里我们先用默认的
    initializeMCPLogger(createMCPLogger('MCPModule'));

    // 2. 初始化和验证配置
    // 注意：我们将直接使用传入的`config`来实例化Agent，因为它已经包含了所有需要的配置
    const finalConfig = config || getConfig();
    const validation = validateConfig(finalConfig);

    if (!validation.isValid) {
      logger.warn('MCP configuration has issues.', {
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    // 3. 创建和初始化 MCPAgent
    if (finalConfig.enabled) {
      this.agent = new MCPAgent(finalConfig);
      await this.agent.initialize();
      logger.info('MCPAgent initialized successfully.');
    } else {
      logger.info('MCP is disabled in the configuration.');
    }
  }

  /**
   * 获取 MCPAgent 的单例
   * @returns MCPAgent 实例
   */
  getAgent(): MCPAgent {
    if (!this.agent) {
      // 考虑到 mcp 可能被禁用，这里做一个优雅的降级处理或明确的错误提示
      throw new Error(
        'MCPAgent is not available. Ensure MCPService is started and MCP is enabled in config.'
      );
    }
    return this.agent;
  }

  /**
   * 停止 MCP 模块并清理资源
   */
  async stop(): Promise<void> {
    logger.info('Stopping MCPService...');
    if (this.agent) {
      await this.agent.shutdown();
      this.agent = undefined;
    }
    logger.info('MCPService stopped.');
  }
}
