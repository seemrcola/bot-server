/**
 * 这是一个用于测试的、模拟的外部 MCP 服务器。
 * 它独立运行，并提供一个独特的工具，以验证 ClientManager 的功能。
 */
import { MCPServer } from '../agent/server/index.js';
import { createLogger } from '../utils/logger.js';
import { z } from 'zod';

const logger = createLogger('TestExternalServer');

/**
 * 创建并启动一个测试用的外部 MCP 服务器。
 * @param port 服务器监听的端口
 * @param host 服务器监听的主机
 */
export function startTestExternalServer(port: number, host: string) {
  const testServer = new MCPServer();

  // 为这个外部服务定义一个独特的工具
  const systemInfoTool = {
    name: 'getSystemInfo',
    definition: {
      description: '获取当前服务器的系统信息，例如 Node.js 版本。',
      inputSchema: z.object({}), // 无输入参数
      outputSchema: z.object({
        nodeVersion: z.string(),
      }),
    },
    handler: async () => {
      const nodeVersion = process.version;
      logger.info(`外部工具 getSystemInfo 被调用，返回 Node.js 版本: ${nodeVersion}`);
      return {
        content: [{
          type: 'text',
          text: `当前 Node.js 版本是 ${nodeVersion}`
        }],
        structuredContent: {
          nodeVersion: nodeVersion
        }
      };
    }
  };

  // 注册这个工具
  testServer.registerTools([systemInfoTool]);

  // 启动服务器
  testServer.listen(port, host);

  logger.info(`模拟的外部 MCP 服务器已在 http://${host}:${port}/mcp 启动`);
}
