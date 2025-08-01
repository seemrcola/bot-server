import "dotenv/config";
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { config } from './config/index.js';
import { mainRouter } from './routes/index.js';
import { handleSuccess, handleError } from './middlewares/response.middleware.js';
import { createLogger } from './utils/logger.js';
import { initializeMCP, checkMCPConfiguration } from './mcp/init.js';
import { initializeMCPLogger } from './mcp/adapters/logger-adapter.js';

const app = express();
const logger = createLogger('Server');

// --- 中间件配置 ---
app.use(express.static('public')); // 静态文件服务，用于提供 public/index.html
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
    // 初始化MCP日志系统
    const mcpLogger = createLogger('MCP');
    initializeMCPLogger(mcpLogger);
    
    // 初始化MCP模块
    initializeMCP();
    
    // 检查MCP配置
    const mcpCheck = checkMCPConfiguration();
    if (!mcpCheck.isValid) {
      logger.warn('MCP配置存在问题', { issues: mcpCheck.issues });
    }
    
    app.listen(config.port, () => {
      logger.info('Server started successfully', { 
        port: config.port,
        mcpEnabled: mcpCheck.summary.mcpEnabled
      });
    });

  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1); // 在关键错误后退出进程
  }
}

// 启动服务器
startServer(); 
