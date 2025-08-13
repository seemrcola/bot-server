import "dotenv/config";
import express, { type Express } from 'express';
import cors from 'cors';
import { ChatDeepSeek } from '@langchain/deepseek';
import { config } from './config/index.js';
import { mainRouter } from './routes/index.js';
import { handleSuccess, handleError } from './middlewares/response.middleware.js';
import { createLogger } from './utils/logger.js';
import { Agent, ExternalServerConfig, AgentManager } from './agent/index.js';
import { systemPrompt } from './prompts/index.js';
import { globals } from './globals.js';
import fs from 'fs';
import path from 'path';
import url from 'url';
import getPort, { portNumbers } from 'get-port';

const app: Express = express();
const logger = createLogger('MainServer');

// --- 中间件配置 ---
app.use(express.static('public'));
app.use(express.json());
app.use(cors());
// 处理预检请求（OPTIONS）
app.options('*', cors());

// --- 路由配置 ---
app.use('/', mainRouter);

// --- 响应处理中间件 (必须放在路由之后) ---
app.use(handleSuccess);
app.use(handleError);

function createLLM(): ChatDeepSeek {
  return new ChatDeepSeek({
    apiKey: process.env['LLM_API_KEY'] || '',
    model: process.env['LLM_MODEL'] || 'deepseek-chat',
    temperature: 0.7,
    streaming: true,
    configuration: { baseURL: process.env['LLM_BASE_URL'] || '' }
  });
}

async function loadAndStartExternalServers(): Promise<ExternalServerConfig[]> {
  const externalDir = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), './external');
  const files = fs.readdirSync(externalDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  const host = 'localhost';
  const externalServers: ExternalServerConfig[] = [];
  for (const file of files) {
    const modPath = path.join(externalDir, file);
    const mod = await import(url.pathToFileURL(modPath).href);
    const starter = mod.startExternalServer;
    if (typeof starter === 'function') {
      const port = await getPort({ port: portNumbers(3002, 3999) });
      await starter(port, host);
      const name = path.parse(file).name;
      externalServers.push({ name, version: '1.0.0', url: `http://${host}:${port}/mcp` });
      logger.info('外部 MCP 服务已启动', { name, port });
    } else {
      logger.warn(`外部模块 ${file} 未导出可用的启动函数，已跳过`);
    }
  }
  return externalServers;
}

// 资源池相关逻辑已移除

/**
 * 在 Serverless 环境中：导出 app，由 Vercel 负责监听端口。
 * 在本地/独立进程中：也允许直接 node 运行，这里不再主动 app.listen。
 * 初始化 AgentManager 放在后台执行，冷启动时准备资源。
 */
(async () => {
  try {
    const llm = createLLM();
    const externalServers = await loadAndStartExternalServers();
    const agentManager = new AgentManager();
    const mainAgent = new Agent(llm, externalServers, systemPrompt);
    agentManager.addAgent('main-agent', mainAgent);
    globals.agentManager = agentManager;
    logger.info('AgentManager 已创建并注册默认 Agent: main-agent');
  } catch (error) {
    logger.error('初始化失败', error);
  }
})();

// 本地开发时主动监听端口；在 Vercel 等 Serverless 环境（NODE_ENV=production）由平台托管
if (process.env['NODE_ENV'] !== 'production') {
  const port = Number(process.env['PORT']) || config.port;
  app.listen(port, () => {
    logger.info('[dev] 本地 API 服务器已启动', { 端口: port });
  });
}

export default app;
