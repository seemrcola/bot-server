import type { MCPServerDescription } from '../../types.js'
import { MCPServer } from '@/_agent/index.js'
import { createLogger } from '@/utils/logger.js'

import { discordTool } from './tools/discord.tool.js'
import { memberTool } from './tools/member.tool.js'
import { websiteTool } from './tools/website.tool.js'

const logger = createLogger('AntfeMCP')

const tools = [discordTool, memberTool, websiteTool]

/**
 * 创建并启动一个用于获取Antfe组织官网信息的 MCP 服务器。
 * @param port 服务器监听的端口
 * @param host 服务器监听的主机
 */
export async function startAntfeMCP(
    name: string,
    version: string,
    port: number,
    host: string,
): Promise<MCPServerDescription> {
    const server = new MCPServer({ name, version })

    // tools 列表注册
    for (const tool of tools) {
        server.mcp.registerTool(
            tool.name,
            tool.schema,
            tool.handle as any,
        )
    }

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
