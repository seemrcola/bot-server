/**
 * MCP服务端实现
 */

import { WebSocketServer, WebSocket } from 'ws';
import { mcp } from '../../mcp/index.js';
import { EventEmitter } from 'events';
import type { 
  IMCPServer,
  ITool,
  ToolInfo,
  ToolParameters,
  ToolResult,
  MCPAgentConfig,
} from '../../mcp/types/index.js';

const { utils, service } = mcp;
const { createMCPLogger, MCPError } = utils;

const logger = createMCPLogger('DefaultMCPServer');

export interface MCPServerOptions {
  port: number;
  host: string;
  maxConnections?: number;
  timeout?: number;
}

import type { MCPService } from '../../mcp/service.js';

type ToolService = MCPService;

// ...

export class DefaultMCPServer extends EventEmitter implements IMCPServer {
  private running = false;
  private connections = new Set<WebSocket>();
  private server: WebSocketServer | undefined;
  private options: MCPServerOptions;
  private toolService: ToolService;
  private startTime?: number;

  constructor(options: MCPServerOptions) {
    super();
    this.options = {
      maxConnections: 100,
      timeout: 30000,
      ...options
    };
    this.toolService = mcp.service;
  }

  /**
   * 获取服务器选项
   */
  public getOptions(): MCPServerOptions {
    return this.options;
  }

  public registerTool(tool: ITool): void {
    // This server is a proxy and does not manage tools directly.
    // The registration is handled by the agent.
    logger.info(`Received registration for tool '${tool.name}', but this server does not manage tools.`);
  }

  /**
   * 启动MCP服务端
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.info('MCP Server is already running');
      return;
    }

    return new Promise(async (resolve, reject) => {
      try {
        logger.info(`Starting MCP server on ${this.options.host}:${this.options.port}`);
        
        this.server = new WebSocketServer({
          port: this.options.port,
          host: this.options.host,
        });

        this.server.on('listening', () => {
          this.running = true;
          this.startTime = Date.now();
          this.emit('started');
          logger.info('MCP Server started successfully and is listening.');
          resolve();
        });

        this.server.on('connection', (ws: WebSocket) => {
          this.handleNewConnection(ws);
        });

        this.server.on('error', (error) => {
          logger.error('WebSocket server error', error);
          this.emit('error', error);
          reject(MCPError.initializationError('MCP服务端启动失败', error));
        });

        this.server.on('close', () => {
          logger.info('WebSocket server closed');
        });
        
      } catch (error) {
        logger.error('Failed to start MCP server', error);
        reject(MCPError.initializationError('MCP服务端启动失败', error));
      }
    });
  }

  /**
   * 停止MCP服务端
   */
  async stop(): Promise<void> {
    try {
      if (!this.running) {
        return;
      }

      logger.info('Stopping MCP server');
      
      // 关闭所有连接
      await this.closeAllConnections();
      
      // 关闭服务器
      if (this.server) {
        await this.closeServer();
      }
      
      this.running = false;
      this.emit('stopped');
      logger.info('MCP Server stopped');
      
    } catch (error) {
      logger.error('Error stopping MCP server', error);
      throw MCPError.executionError('MCP服务端停止失败', error);
    }
  }



  /**
   * 初始化服务器
   */
  private initializeServer(): void {
    try {
      logger.info('Initializing WebSocket server...');
      
      this.server = new WebSocketServer({
        port: this.options.port,
        host: this.options.host,
      });

      this.server.on('connection', (ws: WebSocket) => {
        this.handleNewConnection(ws);
      });

      this.server.on('error', (error) => {
        logger.error('WebSocket server error', error);
        this.emit('error', error);
      });

      this.server.on('close', () => {
        logger.info('WebSocket server closed');
      });

    } catch (error) {
      throw MCPError.initializationError('服务器初始化失败', error);
    }
  }

  /**
   * 处理新的客户端连接
   */
  private handleNewConnection(ws: WebSocket): void {
    if (this.connections.size >= (this.options.maxConnections ?? 100)) {
        logger.warn('Max connections reached, rejecting new connection.');
        ws.close(1013, 'Server is busy'); // 1013: Try again later
        return;
    }
    
    logger.info('New client connected, passing to MCP service.');
    this.connections.add(ws);
    this.emit('connection', ws);

    // 将连接交由 MCP Agent 处理
    this.toolService.handleConnection(ws);

    ws.on('close', (code, reason) => {
        logger.info(`Client disconnected from server: code=${code}, reason=${reason.toString()}`);
        this.connections.delete(ws);
        this.emit('disconnection', ws);
    });

    ws.on('error', (error) => {
        logger.error('WebSocket client error on server side', error);
    });
  }


  /**
   * 设置消息处理器
   */
  private async setupMessageHandlers(): Promise<void> {
    try {
      logger.info('Setting up message handlers');
      
      // 在实际实现中，这里会设置WebSocket消息处理
      // 当前为简化实现
      
    } catch (error) {
      throw MCPError.initializationError('消息处理器设置失败', error);
    }
  }

  /**
   * 关闭所有连接
   */
  private async closeAllConnections(): Promise<void> {
    try {
      logger.info(`Closing ${this.connections.size} connections`);
      
      for (const connection of this.connections) {
        connection.close(1000, 'Server is shutting down');
      }
      this.connections.clear();
      
    } catch (error) {
      logger.error('Error closing connections', error);
    }
  }

  /**
   * 关闭服务器
   */
  private async closeServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) {
            logger.error('Failed to close server', err);
            reject(MCPError.executionError('MCP服务端关闭失败', err));
          } else {
            this.server = undefined;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }



  /**
   * 获取服务器状态
   */
  getServerStatus(): {
    running: boolean;
    connections: number;
    tools: number;
    uptime?: number | undefined;
  } {
    return {
      running: this.running,
      connections: this.connections.size,
      tools: 0,
      uptime: this.running && this.startTime ? Date.now() - this.startTime : undefined
    };
  }

  /**
   * 获取连接数
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
}
