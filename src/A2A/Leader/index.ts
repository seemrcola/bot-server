import getPort, { portNumbers } from 'get-port'
import { createLogger } from '../../utils/logger.js'
import { startSystemMCP } from './system.js'
import { startWeatherMCP } from './weather.js'

const logger = createLogger('Leader')

const mcpServersDescription = [
    { name: 'weather-mcp-server', starter: startWeatherMCP },
    { name: 'system-mcp-server', starter: startSystemMCP },
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
    name: 'leader-agent',
    starter: startLeaderServers,
    agentDescription: '系统的主控, 默认使用此agent做调度',
}
