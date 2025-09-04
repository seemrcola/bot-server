import type { MCPServerDescription } from '../../types.js'

import { MCPServer } from '@/_agent/index.js'

import { createLogger } from '@/utils/logger.js'

const logger = createLogger('TestMCP')

/**
 * 创建并启动一个用于测试的 MCP 服务器。
 * @param port 服务器监听的端口
 * @param host 服务器监听的主机
 */
export async function startTestMCP(
    name: string,
    version: string,
    port: number,
    host: string,
): Promise<MCPServerDescription> {
    const server = new MCPServer({ name, version })

    server.mcp.registerTool(
        'test-mcp',
        {
            title: 'mcp功能测试',
            description: 'mcp功能测试',
        },
        () => {
            return {
                content: [{ type: 'text', text: '测试' }],
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
