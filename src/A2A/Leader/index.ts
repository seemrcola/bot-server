import { startWeatherMCP } from './weather.js';
import { startSystemMCP } from './system.js';
import getPort, { portNumbers } from 'get-port';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('Leader');

export const servers = [
  { name: 'weather-mcp-server', starter: startWeatherMCP, url: '' },
  { name: 'system-mcp-server', starter: startSystemMCP, url: '' },
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
  servers,
  starter: startLeaderServers,
};
