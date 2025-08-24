import type { MCPServerDescription } from '../types.js'
import { z } from 'zod'
/**
 * 这是一个用于测试的、模拟的外部 MCP 服务器。
 * 它独立运行，并提供一个独特的工具，以验证 ClientManager 的功能。
 */
import { MCPServer } from '../../agent/index.js'

import { createLogger } from '../../utils/logger.js'

const logger = createLogger('TwoSumMCP')

/**
 * 创建并启动一个测试用的外部 MCP 服务器。
 * @param port 服务器监听的端口
 * @param host 服务器监听的主机
 */
export async function startTwoSumMCP(
    name: string,
    version: string,
    port: number,
    host: string,
): Promise<MCPServerDescription> {
    const server = new MCPServer({ name, version })

    // 注册这个工具
    server.mcp.tool(
        'twoSum',
        {
            num1: z.number().describe('第一个数'),
            num2: z.number().describe('第二个数'),
        },
        { title: '计算两个数相加的结果。' },
        async ({ num1, num2 }) => {
            const result = num1 + num2
            logger.info(`外部工具 twoSum 被调用，num1=${num1}，num2=${num2}，返回结果: ${result}`)
            return {
                content: [{
                    type: 'text',
                    text: `两个数相加的结果是 ${result}`,
                }],
                structuredContent: {
                    result,
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
