import type { MCPServerDescription } from '../../../types.js'
import { MCPServer } from '@/agent/index.js'
import { createLogger } from '@/utils/logger.js'
import {
    ContentParserTool,
    HtmlFetcherTool,
    ResultFormatterTool,
    UrlValidatorTool,
} from './tools/index.js'

const logger = createLogger('WebCatcherMCP')

// 所有工具的定义
const TOOLS = [
    UrlValidatorTool,
    HtmlFetcherTool,
    ContentParserTool,
    ResultFormatterTool,
]

/**
 * 创建并启动一个抓取网页的 MCP 服务器。
 * @param name 服务器名称
 * @param version 服务器版本
 * @param port 服务器监听的端口
 * @param host 服务器监听的主机
 */
export async function startWebCatcherMCP(
    name: string,
    version: string,
    port: number,
    host: string,
): Promise<MCPServerDescription> {
    const server = new MCPServer({ name, version })

    // 自动注册所有工具
    for (const ToolClass of TOOLS) {
        const toolDef = ToolClass.getToolDefinition()

        server.mcp.registerTool(
            toolDef.name,
            toolDef.schema as any,
            toolDef.handler as any,
        )

        logger.info(`已注册工具: ${toolDef.name} - ${toolDef.schema.title}`)
    }

    // 启动服务器
    logger.info(`准备启动网页抓取 MCP 服务器: ${name} @ http://${host}:${port}/mcp`)
    await server.listen(port, host)

    logger.info(`网页抓取 MCP 服务器已启动，提供以下工具：`)
    for (const ToolClass of TOOLS) {
        const toolDef = ToolClass.getToolDefinition()
        logger.info(`- ${toolDef.name}: ${toolDef.schema.title}`)
    }

    return {
        name,
        version,
        url: `http://${host}:${port}/mcp`,
    } as MCPServerDescription
}
