import type { MCPServerDescription } from '../../types.js'
import { z } from 'zod'
import { MCPServer } from '../../../agent/index.js'
import { createLogger } from '../../../utils/logger.js'

const logger = createLogger('TestCompareMCP')

/**
 * 创建并启动一个测试用的外部 MCP 服务器 - 数值比较功能
 */
export async function startTestCompareMCP(
    name: string,
    version: string,
    port: number,
    host: string,
): Promise<MCPServerDescription> {
    const server = new MCPServer({ name, version })

    // 注册数值比较工具
    server.mcp.registerTool(
        'compare',
        {
            title: '比较两个数的大小',
            description: '比较两个数的大小，用于测试和演示数值比较功能',
            inputSchema: {
                num1: z.number().describe('第一个数'),
                num2: z.number().describe('第二个数'),
            },
            outputSchema: {
                result: z.string().describe('比较结果'),
            },
        },
        async ({ num1, num2 }) => {
            let result: string
            if (num1 > num2) {
                result = `${num1} 大于 ${num2}`
            }
            else if (num1 < num2) {
                result = `${num1} 小于 ${num2}`
            }
            else {
                result = `${num1} 等于 ${num2}`
            }
            logger.info(`Test Agent 工具 compare 被调用，num1=${num1}，num2=${num2}，返回结果: ${result}`)
            return {
                content: [{
                    type: 'text',
                    text: `两个数比较的结果是 ${result}`,
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
