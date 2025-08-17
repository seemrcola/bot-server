/**
 * 这是一个用于测试的、模拟的外部 MCP 服务器。
 * 它独立运行，并提供一个独特的工具，以验证 ClientManager 的功能。
 */
import { MCPServer } from '../../../agent/index.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('WeatherMCP');

/**
 * 创建并启动一个测试用的外部 MCP 服务器。
 * @param port 服务器监听的端口
 * @param host 服务器监听的主机
 */
export async function startAntfeMCP(
    name: string, 
    version: string,
    port: number, 
    host: string
): Promise<{ name: string, version: string, url: string }> {
  const server = new MCPServer({ name, version });

  // 注册这个工具
  server.mcp.tool(
    'getAntfeMember',
    '获取Antfe组织成员信息。',
    {}, // 无输入参数，传入空对象
    async () => {
      const member = '显林叔';
      logger.info(`外部工具 getAntfeMember 被调用，返回Antfe组织成员信息: ${member}`);
      return {
        content: [{
          type: 'text',
          text: `当前Antfe组织成员是 ${member}`
        }],
        structuredContent: {
          member: member
        }
      };
    }
  );

  // 启动服务器
  // 返回一个在服务器启动完成后 resolve 的 Promise
  logger.info(`准备启动外部 MCP 服务器: ${name} @ http://${host}:${port}/mcp`);
  await server.listen(port, host);

  return {
    name,
    version,
    url: `http://${host}:${port}/mcp`,
  }
}
