import { createLogger } from '../../utils/logger.js';
import { MCPClient } from './MCPClient.js';

const logger = createLogger('ClientManager');

/**
 * 外部服务器的配置接口
 */
export interface ExternalServerConfig {
  name: string;
  url: string;
}

/**
 * 管理与多个外部 MCP 服务器的连接。
 */
export class ClientManager {
  private clients: Map<string, MCPClient> = new Map();
  private toolToServerMap: Map<string, string> = new Map(); // K: toolName, V: serverName

  constructor() {
    logger.info('客户端管理器已创建。');
  }

  /**
   * 连接到所有配置的外部服务器，并发现它们的工具。
   * @param serverConfigs 外部服务器配置数组
   */
  public async connect(serverConfigs: ExternalServerConfig[] = []) {
    logger.info(`正在连接到 ${serverConfigs.length} 个外部服务器...`);

    for (const config of serverConfigs) {
      if (this.clients.has(config.name)) {
        logger.warn(`已存在名为 ${config.name} 的客户端连接，将跳过。`);
        continue;
      }

      try {
        const client = new MCPClient();
        await client.connect(config.url);
        this.clients.set(config.name, client);
        logger.info(`成功连接到外部服务器: ${config.name}`);

        // 发现并注册该服务器的工具
        const tools = (await client.listTools()) as any[];
        for (const tool of tools) {
          if (tool && tool.name) {
            this.toolToServerMap.set(tool.name, config.name);
            logger.info(`  - 发现外部工具: ${tool.name} (位于 ${config.name})`);
          }
        }
      } catch (error) {
        logger.error(`连接到外部服务器 ${config.name} 失败`, error);
      }
    }
  }

  /**
   * 汇总并返回所有外部工具的列表。
   * @returns 一个包含所有外部工具的数组
   */
  public async getAllTools(): Promise<any[]> {
    let allTools: any[] = [];
    for (const client of this.clients.values()) {
      try {
        const tools = (await client.listTools()) as any[];
        if (tools) {
          allTools = allTools.concat(tools);
        }
      } catch (error) {
        logger.error('从客户端获取工具列表失败', error);
      }
    }
    return allTools;
  }

  /**
   * 调用一个指定的外部工具。
   * @param toolName 要调用的工具名称
   * @param args 工具的参数
   * @returns 工具的执行结果
   */
  public async callTool(toolName: string, args: any): Promise<any> {
    const serverName = this.toolToServerMap.get(toolName);
    if (!serverName) {
      throw new Error(`未找到能提供工具 '${toolName}' 的外部服务器。`);
    }

    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`找不到名为 '${serverName}' 的客户端实例。`);
    }

    logger.info(`通过客户端 '${serverName}' 调用外部工具 '${toolName}'`);
    return client.callTool(toolName, args);
  }
}
