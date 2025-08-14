import getPort, { portNumbers } from 'get-port';
import { startAntfeMCP } from './member.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('AntfeMCP');


export const servers = [
  { name: 'antfe-mcp-server', starter: startAntfeMCP, url: '' },
];

export async function startLeaderServers() {
  for (const server of servers) {
    const port = await getPort({ port: portNumbers(3100, 3999) });
    await server.starter(server.name, '1.0.0', port, 'localhost');
    server.url = `http://localhost:${port}/mcp`;
    logger.info(`${server.name} 已启动，监听端口：${port}`);
  }
};

export default {
  name: 'antfe-agent',
  servers,
  starter: startLeaderServers,
  agentDescription: '当用户需要获取Antfe相关信息时, 使用此agent',
};
