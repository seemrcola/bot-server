import "dotenv/config";
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { config } from './config/index.js';
import { mainRouter } from './routes/index.js';
import { handleSuccess, handleError } from './middlewares/response.middleware.js';
import { createLogger } from './utils/logger.js';
import { mcp } from './mcp/index.js';

// --- 应用层服务与工具定义 ---
import AshitaNoJoeTool from './servers/default/ashitano-joe.tool.js';
import JoJoTool from './servers/default/jojo.tool.js';
import { DefaultMCPServer } from './servers/default/mcp-server.js';
import { FileProvider } from './mcp/resources/providers/file-provider.js';

const app = express();
const logger = createLogger('Server');

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
    // 1. 创建应用层的服务实例和工具实例
    const defaultServer = new DefaultMCPServer(
      { port: 4001, host: 'localhost' }
    );

    // 2. 准备要注入到 MCP 模块的服务器注册信息
    const serverRegistrations = [
      { name: 'default-server', server: defaultServer },
      // 如果需要，在此处添加其他服务器
    ];

    // 3. 准备资源提供者的注册信息
    const resourceProviders = [
      new FileProvider(), // 根目录默认为 process.cwd()
      // 如果需要，在此处添加其他提供者，如 HttpProvider
    ];

    // 4. 启动 MCP 服务，注入服务器和资源提供者
    await mcp.service.start(undefined, serverRegistrations, resourceProviders);

    // 5. 将工具注册到对应的服务器
    mcp.service.registerTool(new AshitaNoJoeTool(), 'default-server');
    mcp.service.registerTool(new JoJoTool(), 'default-server');

    // 6. 启动 Express 应用
    app.listen(config.port, () => {
      const agentStatus = mcp.service.getAgent()?.getStatus();
      logger.info('服务启动成功', {
        port: config.port,
        mcpEnabled: agentStatus?.enabled || false,
        registeredTools: agentStatus?.registeredTools || [],
      });
    });

  } catch (error) {
    logger.error("服务启动失败", error);
    process.exit(1);
  }
}

// 启动服务
startServer();
