import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createLogger } from '../../utils/logger.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

const logger = createLogger('MCPServer');

/**
 * 一个基础的 MCP 服务器类，使用 @modelcontextprotocol/sdk。
 * 它通过 Express 提供一个 /mcp 端点来处理 MCP 请求。
 */
export class MCPServer {
  private mcpServer: McpServer;
  private app: express.Express;

  constructor({ name, version }: { name: string, version: string }) {
    this.mcpServer = new McpServer({
      name,
      version,
    });

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use(cors({
      origin: '*', // 在生产环境中应配置为更严格的源
      exposedHeaders: ['Mcp-Session-Id'],
      allowedHeaders: ['Content-Type', 'mcp-session-id'],
    }));
  }

  private setupRoutes() {
    const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};
    
    this.app.post('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      // 如果会话ID存在，则使用已有的传输
      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
        await transport.handleRequest(req, res, req.body);
      } 
      // 如果会话ID不存在，且是初始化请求，则创建新的传输
      else if (!sessionId && isInitializeRequest(req.body)) {
        /**********************************************
         * 创建一个传输层，并设置会话ID生成器和会话初始化回调
         * 当会话初始化时，将传输层添加到传输层映射中
         * 当传输层关闭时，从传输层映射中删除传输层
         **********************************************/
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => { transports[newSessionId] = transport; },
        });
        transport.onclose = () => {
          if (transport.sessionId) {
            Reflect.deleteProperty(transports, transport.sessionId);
          }
        };
        await this.mcpServer.connect(transport as any);

        /**********************************************
         * 处理请求
         * 这里的传输层可以处理请求并且返回响应 由传输层自身支持
         * 三个参数分别是：
         * 1. 请求对象
         * 2. 响应对象
         * 3. 请求体
         **********************************************/
        await transport.handleRequest(req, res, req.body);
      } 
      // 如果会话ID不存在，且不是初始化请求，则返回400错误
      else {
        res
          .status(400)
          .json({ 
            jsonrpc: '2.0', 
            error: { code: -32000, message: 'Bad Request' }, 
            id: null 
          });
      }
    });

    const handleSessionRequest = async (
      req: express.Request, 
      res: express.Response
    ) => {
      // 你是谁
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      // 我是否认识你
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('无效或缺失的会话 ID');
      } 
      // 如果找到了那就直接处理请求
      // transport内部自己会处理请求 
      // 如果是get请求 会调用handleGetRequest 
      // 如果是delete请求 会调用handleDeleteRequest
      else {
        await transports[sessionId]!.handleRequest(req, res, req.body);
      }
    };

    this.app.get('/mcp', handleSessionRequest);
    this.app.delete('/mcp', handleSessionRequest);
  }

  public get mcp(): McpServer {
    return this.mcpServer;
  }

  /**
   * 启动 MCP 服务器并监听指定端口。
   * @param port 监听的端口号
   * @param host 监听的主机名
   * @returns 一个 Promise，在服务器成功启动时解析
   */
  public listen(port: number, host: string): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, host, () => {
        logger.info(`MCP 服务器正在监听 http://${host}:${port}/mcp`);
        resolve();
      });
    });
  }
}
