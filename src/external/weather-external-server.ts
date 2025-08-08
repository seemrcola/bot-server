/**
 * 这是一个用于测试的、模拟的外部 MCP 服务器。
 * 它独立运行，并提供一个独特的工具，以验证 ClientManager 的功能。
 */
import { MCPServer } from '../agent/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TestExternalServer');

/**
 * 创建并启动一个测试用的外部 MCP 服务器。
 * @param port 服务器监听的端口
 * @param host 服务器监听的主机
 */
export function startTestExternalServer(port: number, host: string) {
  const testServer = new MCPServer(
    {
      name: 'weather-external-server',
      version: '1.0.0',
    }
  );

  // 注册这个工具
  testServer.mcp.tool(
    'getWeather',
    '获取当前的天气信息。',
    {}, // 无输入参数，传入空对象
    async () => {
      const weather = '晴天';
      logger.info(`外部工具 getWeather 被调用，返回天气: ${weather}`);
      return {
        content: [{
          type: 'text',
          text: `当前天气是 ${weather}`
        }],
        structuredContent: {
          weather: weather
        }
      };
    }
  );

  // 启动服务器
  testServer.listen(port, host);

  logger.info(`模拟的外部 MCP 服务器已在 http://${host}:${port}/mcp 启动`);
}

// 统一导出名，便于动态装载器发现启动函数
export const startExternalServer = startTestExternalServer;
