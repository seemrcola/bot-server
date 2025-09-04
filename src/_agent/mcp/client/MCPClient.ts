import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createLogger } from '../../utils/logger.js'

const logger = createLogger('MCPClient')

/**
 * 一个基础的 MCP 客户端类，使用 @modelcontextprotocol/sdk。
 * 它可以连接到一个指定的 MCP 服务器。
 */
export class MCPHttpClient {
    private client: McpClient

    constructor({ name, version }: { name: string, version: string }) {
        this.client = new McpClient({
            name,
            version,
        })
    }

    /**
     * 连接到指定的 MCP 服务器。
     * @param serverUrl 要连接的服务器的 URL
     */
    public async connect(serverUrl: string) {
        try {
            const transport = new StreamableHTTPClientTransport(
                new URL(serverUrl),
            )
            await this.client.connect(transport as any)
            logger.info(`MCP 客户端已成功连接到: ${serverUrl}`)
        }
        catch (error) {
            logger.error(`MCP 客户端连接失败: ${serverUrl}`, error)
            throw error
        }
    }

    /**
     * 调用远程服务器上的工具。
     * @param toolName 工具名称
     * @param parameters 工具参数
     * @returns 工具执行结果
     */
    public async callTool(toolName: string, parameters: any): Promise<any> {
        logger.info(`正在调用远程工具: ${toolName}`)
        return this.client.callTool({ name: toolName, arguments: parameters })
    }

    /**
     * 列出远程服务器上的所有可用工具。
     * @returns 工具列表
     */
    public async listTools(): Promise<any> {
        logger.info('正在获取远程工具列表...')
        return this.client.listTools()
    }
}
