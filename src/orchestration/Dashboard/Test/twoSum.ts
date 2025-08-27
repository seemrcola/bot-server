import type { MCPServerDescription } from '../../types.js'
import { z } from 'zod'
import { MCPServer } from '../../../agent/index.js'
import { createLogger } from '../../../utils/logger.js'

const logger = createLogger('TestTwoSumMCP')

/**
 * 创建并启动一个测试用的外部 MCP 服务器 - 两数相加功能
 */
export async function startTestTwoSumMCP(
    name: string,
    version: string,
    port: number,
    host: string,
): Promise<MCPServerDescription> {
    const server = new MCPServer({ name, version })

    // 注册两数相加工具
    server.mcp.registerTool(
        'twoSum',
        {
            title: '计算两个数相加的结果',
            description: '计算两个数相加的结果，用于测试和演示数学计算功能',
            inputSchema: {
                num1: z.number().describe('第一个数'),
                num2: z.number().describe('第二个数'),
            },
            outputSchema: {
                result: z.number().describe('相加的结果'),
            },
        },
        async ({ num1, num2 }) => {
            const result = num1 + num2
            logger.info(`Test Agent 工具 twoSum 被调用，num1=${num1}，num2=${num2}，返回结果: ${result}`)
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

    logger.info(`准备启动外部 MCP 服务器: ${name} @ http://${host}:${port}/mcp`)
    await server.listen(port, host)

    return {
        name,
        version,
        url: `http://${host}:${port}/mcp`,
    } as MCPServerDescription
}
