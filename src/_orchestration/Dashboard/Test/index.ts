import getPort, { portNumbers } from 'get-port'
import { createLogger } from '@/utils/logger.js'
import { startTestMCP } from './mcp.js'

const logger = createLogger('TestMCP')

export const mcpServersDescription = [
    { name: 'test-mcp-server', starter: startTestMCP },
]

export async function startLeaderServers() {
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
    name: 'test-agent',
    starter: startLeaderServers,
    agentDescription: '当用户需要agent基本功能测试时, 使用此agent',
}
