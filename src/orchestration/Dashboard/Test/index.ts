import getPort, { portNumbers } from 'get-port'
import { createLogger } from '@/utils/logger.js'
import { startTestStrenthTrainingListMCP } from './training.js'

const logger = createLogger('TestAgent')

const mcpServersDescription = [
    { name: 'test-strenth-training-list-mcp-server', starter: startTestStrenthTrainingListMCP },
]

export async function startTestServers() {
    const servers = []
    for (const server of mcpServersDescription) {
        const port = await getPort({ port: portNumbers(3200, 3299) })
        const serverInfo = await server.starter(server.name, '1.0.0', port, 'localhost')
        servers.push(serverInfo)
        logger.info(`${server.name} 已启动，监听端口：${port}`)
    }
    return servers
}

export default {
    name: 'test-agent',
    starter: startTestServers,
    agentDescription: '测试代理，专门用于力量训练列表',
    meta: {
        keywords: ['测试', '力量训练', '训练列表'],
        aliases: ['test', 'strength', 'training', 'list'],
    },
}
