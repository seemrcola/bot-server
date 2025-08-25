import getPort, { portNumbers } from 'get-port'
import { createLogger } from '../../../utils/logger.js'
import { startAntfeMCP } from './member.js'

const logger = createLogger('AntfeMCP')

export const mcpServersDescription = [
    { name: 'antfe-mcp-server', starter: startAntfeMCP },
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
    name: 'antfe-agent',
    starter: startLeaderServers,
    agentDescription: '当用户需要获取Antfe相关信息时, 使用此agent',
}
