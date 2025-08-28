import { createLogger } from '../../utils/logger.js'

const logger = createLogger('Leader')

export async function startLeaderServers() {
    logger.info('leader-agent 启动中...')
    return []
};

export default {
    name: 'leader-agent',
    starter: startLeaderServers,
    agentDescription: `
        系统的主控, 默认使用此agent做调度
        当信息进入的时候，此agent会识别信息并分发给其他agent处理（如有需要）`,
    meta: {
        keywords: ['主控', '系统', '调度', '管理', '默认'],
        aliases: ['leader', 'main', 'system', 'default'],
    },
}
