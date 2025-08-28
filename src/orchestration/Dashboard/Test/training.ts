import type { MCPServerDescription } from '../../types.js'
import { z } from 'zod'
import { MCPServer } from '@/agent/index.js'
import { createLogger } from '@/utils/logger.js'

const logger = createLogger('TestTwoSumMCP')

/**
 * 创建并启动一个测试用的外部 MCP 服务器 - 两数相加功能
 */
export async function startTestStrenthTrainingListMCP(
    name: string,
    version: string,
    port: number,
    host: string,
): Promise<MCPServerDescription> {
    const server = new MCPServer({ name, version })

    // 注册两数相加工具
    server.mcp.registerTool(
        'getStrenthTrainingList',
        {
            title: '获取力量训练列表',
            description: '获取力量训练列表',
            outputSchema: {
                result: z.array(z.object({
                    name: z.string().describe('训练名称'),
                    description: z.string().describe('训练描述'),
                })).describe('训练列表'),
            },
        },
        async () => {
            const result = [
                {
                    name: '深蹲',
                    description: '深蹲是一种常见的力量训练动作，主要锻炼腿部肌肉。',
                },
                {
                    name: '卧推',
                    description: '卧推是一种常见的力量训练动作，主要锻炼胸部肌肉。',
                },
            ]
            logger.info(`Test Agent 工具 getStrenthTrainingList 被调用，返回结果: ${result}`)
            return {
                content: [{
                    type: 'text',
                    text: `力量训练列表是 ${result.map(item => item.name).join(', ')}`,
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
