import "dotenv/config";
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { config } from './config/index.js';
import { mainRouter } from './routes/index.js';
import { handleSuccess, handleError } from './middlewares/response.middleware.js';
import { createLogger } from './utils/logger.js';
import { MCPService } from './mcp/service.js';
import { MCPAgentConfig } from "./mcp/types/index.js";
import { getDefaultConfig } from './mcp/config/index.js';

const app = express();
const logger = createLogger('Server');

// --- 中间件配置 ---
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(cors());

// --- 路由配置 ---
app.use('/', mainRouter);

// --- 响应处理中间件 (必须在路由之后) ---
app.use(handleSuccess);
app.use(handleError);

/**
 * 启动 Express 服务器并执行初始化任务。
 */
async function startServer() {
  try {
    // 从MCP模块获取一份完整的默认配置
    const mcpConfig = getDefaultConfig();

    // 使用环境变量中的值覆盖LLM相关的配置
    mcpConfig.llm.apiKey = process.env["LLM_API_KEY"] || '';
    mcpConfig.llm.model = process.env["LLM_MODEL"] || 'deepseek-chat';
    if (mcpConfig.llm.configuration) {
        mcpConfig.llm.configuration.baseURL = process.env["LLM_BASE_URL"] || '';
    }

    // 统一启动 MCP 服务, 传入结构完整的配置
    await MCPService.getInstance().start(mcpConfig);

    app.listen(config.port, () => {
      const agentStatus = MCPService.getInstance().getAgent()?.getStatus();
      logger.info('Server started successfully', {
        port: config.port,
        mcpEnabled: agentStatus?.enabled || false,
      });
    });

  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

// 启动服务器
startServer();
