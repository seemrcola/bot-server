import { createLogger } from '../../utils/logger.js'
import { MCPHttpClient } from './MCPClient.js'

const logger = createLogger('ClientManager')

/**
 * 外部服务器的配置接口
 */
export interface ExternalServerConfig {
    name: string
    version: string
    url: string
}

/**
 * 外部工具的结构
 */
export interface ExternalTool {
    name: string
    inputSchema?: unknown
    annotations?: {
        title?: string
        [key: string]: string
    }
    [key: string]: any
}

/**
 * 管理与多个外部 MCP 服务器的连接。
 */
export class ClientManager {
    private clients: Map<string, MCPHttpClient> = new Map()
    private toolToServerMap: Map<string, string> = new Map() // K: toolName, V: serverName
    private discoveredTools: ExternalTool[] = []

    constructor() {
        logger.info('客户端管理器已创建。')
    }

    /**
     * 连接到所有配置的外部服务器，并发现它们的工具。
     * @param serverConfigs 外部服务器配置数组
     */
    public async connect(serverConfigs: ExternalServerConfig[] = []) {
        logger.info(`正在连接到 ${serverConfigs.length} 个外部服务器...`)

        for (const config of serverConfigs) {
            if (this.clients.has(config.name)) {
                logger.warn(`已存在名为 ${config.name} 的客户端连接，将跳过。`)
                continue
            }

            try {
                const client = new MCPHttpClient({
                    name: config.name,
                    version: config.version,
                })
                await client.connect(config.url)
                this.clients.set(config.name, client)
                logger.info(`成功连接到外部服务器: ${config.name}`)

                // 发现并注册该服务器的工具
                // 连接上服务之后就可以知道该服务包含哪些工具
                const result = await client.listTools()
                const tools: ExternalTool[] = result.tools || []
                for (const tool of tools) {
                    if (tool && tool.name) {
                        this.toolToServerMap.set(tool.name, config.name)
                        logger.info(`  - 发现外部工具: ${tool.name} (位于 ${config.name})`)
                    }
                }
                /**
                 * 按照名称去重
                 * 这里有个问题 不通的server确实有可能有相同的工具名称
                 * 但是我们不额外考虑这种情况 说明文档中要说明清楚用户在使用agent时 要自行把握名称处理
                 */
                const merged = [...this.discoveredTools, ...tools]
                const dedupedByName = new Map<string, ExternalTool>()
                for (const t of merged) {
                    if (t && t.name && !dedupedByName.has(t.name)) {
                        dedupedByName.set(t.name, t)
                        continue
                    }
                    logger.warn(`发现外部工具: ${t.name} (位于 ${config.name}) 但名称重复，将跳过。`)
                }
                this.discoveredTools = Array.from(dedupedByName.values())
            }
            catch (error) {
                logger.error(`连接到外部服务器 ${config.name} 失败`, error)
            }
        }
    }

    /**
     * 汇总并返回所有外部工具的列表。
     * @returns 一个包含所有外部工具的数组
     */
    public async getAllTools(): Promise<ExternalTool[]> {
    // 直接返回连接阶段缓存的工具清单
        return [...this.discoveredTools]
    }

    /**
     * 调用一个指定的外部工具。
     * @param toolName 要调用的工具名称
     * @param args 工具的参数
     * @returns 工具的执行结果
     */
    public async callTool(toolName: string, args: any): Promise<any> {
        const serverName = this.toolToServerMap.get(toolName)
        if (!serverName) {
            throw new Error(`未找到能提供工具 '${toolName}' 的外部服务器。`)
        }

        const client = this.clients.get(serverName)
        if (!client) {
            throw new Error(`找不到名为 '${serverName}' 的客户端实例。`)
        }

        logger.info(`通过客户端 '${serverName}' 调用外部工具 '${toolName}'`)
        return client.callTool(toolName, args)
    }
}
