import "dotenv/config";
import express, { type Express } from 'express';
import cors from 'cors';
import { ChatDeepSeek } from '@langchain/deepseek';
import { config } from './config/index.js';
import { mainRouter } from './routes/index.js';
import { handleSuccess, handleError } from './middlewares/response.middleware.js';
import { createLogger } from './utils/logger.js';
import { Agent } from './agent/index.js';
import { AgentManager } from './A2A/manager.js';
import { systemPrompt } from './prompts/index.js';
import { globals } from './globals.js';
import leader from './A2A/Leader/index.js';

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
    model: process.env['LLM_MODEL'] || '',
    temperature: 0.7,
    streaming: true,
    configuration: { baseURL: process.env['LLM_BASE_URL'] || '' }
  });
}

/**
 * 在 Serverless 环境中：导出 app，由 Vercel 负责监听端口。
 * 在本地/独立进程中：也允许直接 node 运行，这里不再主动 app.listen。
 * 初始化 AgentManager 放在后台执行，冷启动时准备资源。
 */
(async () => {
  try {
    // 先创建出一个 leader agent 后续由他统筹和找到其它agent
    // 创建llm
    const llm = createLLM();
    // 创建agent manager
    const agentManager = new AgentManager();
    // 启动leader的mcp服务
    await leader.starter();
    // 获取leader的mcp服务配置
    const servers = leader.servers.map(server => ({
      name: server.name,
      version: '1.0.0',
      url: server.url
    }));
    // 创建leader agent
    const mainAgent = new Agent(llm, servers, systemPrompt);
    // 注册leader agent
    agentManager.registerLeader('main-agent', mainAgent, '系统的主控 Agent（Leader），负责默认路由与兜底处理');
    // 注册全局变量
    globals.agentManager = agentManager;

    logger.info('AgentManager 已创建并注册 Leader: main-agent');
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
