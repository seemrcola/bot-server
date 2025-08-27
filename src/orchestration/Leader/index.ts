import getPort, { portNumbers } from 'get-port'
import { createLogger } from '../../utils/logger.js'
import { startSystemMCP } from './system.js'

const logger = createLogger('Leader')

const mcpServersDescription = [
    { name: 'system-mcp-server', starter: startSystemMCP },
]

export async function startLeaderServers() {
    const servers = []
    for (const server of mcpServersDescription) {
        const port = await getPort({ port: portNumbers(3100, 3199) })
        const serverInfo = await server.starter(server.name, '1.0.0', port, 'localhost')
        servers.push(serverInfo)
        logger.info(`${server.name} 已启动，监听端口：${port}`)
    }
    return servers
};

export default {
    name: 'leader-agent',
    starter: startLeaderServers,
    agentDescription: '系统的主控, 默认使用此agent做调度，提供系统信息查询功能',
    meta: {
        keywords: ['主控', '系统', '调度', '管理', '默认'],
        aliases: ['leader', 'main', 'system', 'default'],
    },
}
