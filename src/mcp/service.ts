/**
 * MCP 统一服务
 * 负责管理 MCP 模块的生命周期和提供 Agent 的单例
 */
import { MCPAgent } from './agent/mcp-agent.js';
import { MCPAgentConfig, IMCPServer } from './types/index.js';
import { createMCPLogger, setGlobalLogger } from './utils/logger.js';
import { ConfigManager } from './config/manager.js';

const logger = createMCPLogger('MCPService');

type ServerRegistration = {
  name: string;
  server: IMCPServer;
};
class MCPService {
  private static instance: MCPService;
  private agent: MCPAgent | undefined;
  private configManager: ConfigManager;

  private constructor() {
    this.configManager = ConfigManager.getInstance();
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
  async start(
    config?: Partial<MCPAgentConfig>,
    serverRegistrations?: ServerRegistration[]
  ): Promise<void> {
    if (this.agent) {
      logger.info('MCPService has already been started.');
      return;
    }

    logger.info('Starting MCPService...');
    setGlobalLogger(createMCPLogger('MCPModule'));

    if (config) {
      this.configManager.updateConfig(config);
    }

    const finalConfig = this.configManager.getConfig();
    const validation = this.configManager.getHealth();

    if (!validation.isValid) {
      logger.warn('MCP configuration has issues.', {
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    if (finalConfig.enabled) {
      this.agent = new MCPAgent(finalConfig, serverRegistrations);
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

export const mcpService = MCPService.getInstance();
