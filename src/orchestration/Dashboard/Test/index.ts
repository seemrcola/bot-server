import getPort, { portNumbers } from 'get-port'
import { createLogger } from '../../../utils/logger.js'
import { startTestCompareMCP } from './compare.js'
import { startTestTwoSumMCP } from './twoSum.js'

const logger = createLogger('TestAgent')

const mcpServersDescription = [
    { name: 'test-compare-mcp-server', starter: startTestCompareMCP },
    { name: 'test-twosum-mcp-server', starter: startTestTwoSumMCP },
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
    agentDescription: '测试代理，专门用于数学计算和比较操作，包含两数相加和数值比较功能',
    meta: {
        keywords: ['测试', '数学', '计算', '比较', '加法', '两数相加', '数值比较'],
        aliases: ['test', 'math', 'calculate', 'compare'],
    },
}
