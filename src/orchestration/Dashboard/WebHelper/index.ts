import getPort, { portNumbers } from 'get-port'
import { createLogger } from '@/utils/logger.js'
import { startWebCatcherMCP } from './webCatcher/index.js'

const logger = createLogger('WebHelperMCP')

export const mcpServersDescription = [
    { name: 'web-catcher-mcp-server', starter: startWebCatcherMCP },
]

export async function startWebHelperServers() {
    const servers = []
    for (const server of mcpServersDescription) {
        const port = await getPort({ port: portNumbers(3100, 3999) })
        const serverInfo = await server.starter(server.name, '1.0.0', port, 'localhost')
        servers.push(serverInfo)
        logger.info(`${server.name} 已启动，监听端口：${port}`)
    }
    return servers
};

export default {
    name: 'web-helper-agent',
    starter: startWebHelperServers,
    agentDescription: '当用户需要获取网页相关信息时, 使用此agent',
}
