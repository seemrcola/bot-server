import type { MCPServerDescription } from '../types.js'
import process from 'node:process'
/**
 * 这是一个用于测试的、模拟的外部 MCP 服务器。
 * 它独立运行，并提供一个独特的工具，以验证 ClientManager 的功能。
 */
import { MCPServer } from '../../agent/index.js'
import { createLogger } from '../../utils/logger.js'

const logger = createLogger('SystemMCP')

/**
 * 创建并启动一个测试用的外部 MCP 服务器。
 * @param port 服务器监听的端口
 * @param host 服务器监听的主机
 */
export async function startSystemMCP(
    name: string,
    version: string,
    port: number,
    host: string,
): Promise<MCPServerDescription> {
    const server = new MCPServer({ name, version })

    // 注册这个工具
    server.mcp.registerTool(
        'getSystemInfo',
        {
            title: '获取服务器信息',
            description: '获取当前服务器的系统信息，例如 Node.js 版本。',
        },
        async () => {
            const nodeVersion = process.version
            logger.info(`外部工具 getSystemInfo 被调用，返回 Node.js 版本: ${nodeVersion}`)
            return {
                content: [{
                    type: 'text',
                    text: `当前 Node.js 版本是 ${nodeVersion}`,
                }],
                structuredContent: {
                    nodeVersion,
                },
            }
        },
    )

    // 启动服务器
    // 返回一个在服务器启动完成后 resolve 的 Promise
    logger.info(`准备启动外部 MCP 服务器: ${name} @ http://${host}:${port}/mcp`)
    await server.listen(port, host)

    return {
        name,
        version,
        url: `http://${host}:${port}/mcp`,
    } as MCPServerDescription
}
