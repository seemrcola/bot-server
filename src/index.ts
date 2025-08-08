import "dotenv/config";
import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { mainRouter } from './routes/index.js';
import { handleSuccess, handleError } from './middlewares/response.middleware.js';
import { createLogger } from './utils/logger.js';
import { Agent, ExternalServerConfig, AgentManager, QuietChatOpenAI } from './agent/index.js';
import { systemPrompt } from './prompts/index.js';
import { globals } from './globals.js';
import fs from 'fs';
import path from 'path';
import url from 'url';
import getPort, { portNumbers } from 'get-port';

const app = express();
const logger = createLogger('MainServer');

// --- 中间件配置 ---
app.use(express.static('public'));
app.use(express.json());
app.use(cors());

// --- 路由配置 ---
app.use('/', mainRouter);

// --- 响应处理中间件 (必须放在路由之后) ---
app.use(handleSuccess);
app.use(handleError);

function createLLM(): QuietChatOpenAI {
  return new QuietChatOpenAI({
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
 * 启动 Express 服务并初始化应用服务。
 */
async function startServer() {
  try {
    const llm = createLLM();
    const externalServers = await loadAndStartExternalServers();

    // 创建 AgentManager 与默认 Agent
    const agentManager = new AgentManager();
    const mainAgent = new Agent(llm, externalServers, systemPrompt);
    agentManager.addAgent('main-agent', mainAgent);
    globals.agentManager = agentManager;
    logger.info('AgentManager 已创建并注册默认 Agent: main-agent');

    // 资源池相关逻辑已移除

    // 启动主 API 服务器
    app.listen(config.port, () => {
      logger.info('API 服务器正在监听', { 端口: config.port });
    });
  } catch (error) {
    logger.error('服务启动失败', error);
    process.exit(1);
  }
}

// 启动服务
startServer();
