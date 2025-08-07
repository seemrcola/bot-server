import "dotenv/config";
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { config } from './config/index.js';
import { mainRouter } from './routes/index.js';
import { handleSuccess, handleError } from './middlewares/response.middleware.js';
import { createLogger } from './utils/logger.js';
import { Agent, ExternalServerConfig } from './agent/index.js';
import { ChatOpenAI } from '@langchain/openai';
import { tools } from './tools/index.js';
import { systemPrompt } from './prompts/index.js';
import { globals } from './globals.js';
import { startTestExternalServer } from "./external/test-external-server.js";

const app = express();
const logger = createLogger('MainServer');

// --- 中间件配置 ---
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(cors());

// --- 路由配置 ---
app.use('/', mainRouter);

// --- 响应处理中间件 (必须放在路由之后) ---
app.use(handleSuccess);
app.use(handleError);

/**
 * 启动 Express 服务并初始化应用服务。
 */
async function startServer() {
  try {
    // 1. 启动模拟的外部 MCP 服务器
    const externalServerPort = 3002;
    const externalServerHost = 'localhost';
    startTestExternalServer(externalServerPort, externalServerHost);

    // 2. 准备 Agent 的“原料”
    const llm = new ChatOpenAI({
      apiKey: process.env['LLM_API_KEY'] || '',
      model: process.env['LLM_MODEL'] || 'deepseek-chat',
      temperature: 0.7,
      streaming: true,
      configuration: { baseURL: process.env['LLM_BASE_URL'] || '' }
    });

    // 定义外部服务器列表
    const externalServers: ExternalServerConfig[] = [
      { 
        name: 'TestSystemInfoServer', 
        version: '1.0.0',
        url: `http://${externalServerHost}:${externalServerPort}/mcp` 
      }
    ];

    // 3. 创建 Agent 实例并将其存入全局容器
    // Agent 的构造函数会异步地完成其外部服务的初始化
    globals.agent = new Agent(llm, externalServers, systemPrompt);
    logger.info('Agent 实例已创建，正在后台进行初始化...');

    // 4. 启动主 API 服务器
    app.listen(config.port, () => {
      logger.info('API 服务器正在监听', {
        端口: config.port,
      });
    });

  } catch (error) {
    logger.error("服务启动失败", error);
    process.exit(1);
  }
}

// 启动服务
startServer();
