import type { MCPServerDescription } from '../types.js'
import { z } from 'zod'
/**
 * 这是一个用于测试的、模拟的外部 MCP 服务器。
 * 它独立运行，并提供一个独特的工具，以验证 ClientManager 的功能。
 */
import { MCPServer } from '../../agent/index.js'

import { createLogger } from '../../utils/logger.js'

const logger = createLogger('WeatherMCP')

/**
 * 创建并启动一个测试用的外部 MCP 服务器。
 * @param port 服务器监听的端口
 * @param host 服务器监听的主机
 */
export async function startWeatherMCP(
    name: string,
    version: string,
    port: number,
    host: string,
): Promise<MCPServerDescription> {
    const server = new MCPServer({ name, version })

    // 注册这个工具
    server.mcp.tool(
        'getWeather',
        {
            city: z.string().describe('城市名称'),
        },
        { title: '获取当前的天气信息。' },
        async ({ city }) => {
            const weather = '晴天'
            logger.info(`外部工具 getWeather 被调用，city=${city}，返回天气: ${weather}`)
            return {
                content: [{
                    type: 'text',
                    text: `城市 ${city} 的当前天气是 ${weather}`,
                }],
                structuredContent: {
                    weather,
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
