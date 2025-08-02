/**
 * MCP服务端实现
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IMCPServer, ITool, ToolInfo, ToolParameters, ToolResult } from '../../types/index.js';
import { MCPError } from '../../utils/errors.js';
import { createMCPLogger } from '../../utils/logger.js';
import { EventEmitter } from 'events';
import { ToolRegistry } from '../tool-registry.js';
import { MessageProcessor, MCPMessage, MCPMessageType } from '../../agent/message-processor.js';

const logger = createMCPLogger('Server');

export interface MCPServerOptions {
  port: number;
  host: string;
  maxConnections?: number;
  timeout?: number;
}

export class MCPServer extends EventEmitter implements IMCPServer {
  private running = false;
  private connections = new Set<WebSocket>();
  private server: WebSocketServer | undefined;
  private options: MCPServerOptions;
  private toolRegistry: ToolRegistry;
  private startTime?: number;
  private toolsToRegister: (new () => ITool)[];

  constructor(options: MCPServerOptions, tools: (new () => ITool)[] = []) {
    super();
    this.options = {
      maxConnections: 100,
      timeout: 30000,
      ...options
    };
    this.toolRegistry = new ToolRegistry();
    this.toolsToRegister = tools;
    
    // 监听工具注册表事件
    this.toolRegistry.on('tool-registered', (toolName) => {
      this.emit('tool-registered', toolName);
    });
    
    this.toolRegistry.on('tool-unregistered', (toolName) => {
      this.emit('tool-unregistered', toolName);
    });
    
    this.toolRegistry.on('tool-used', (toolName, stats) => {
      this.emit('tool-used', toolName, stats);
    });
  }

  /**
   * 获取服务器选项
   */
  public getOptions(): MCPServerOptions {
    return this.options;
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
        
        await this.registerConfiguredTools();
        
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
   * 注册工具
   */
  registerTool(tool: ITool): void {
    this.toolRegistry.registerTool(tool);
  }

  /**
   * 注销工具
   */
  unregisterTool(toolName: string): void {
    this.toolRegistry.unregisterTool(toolName);
  }

  /**
   * 获取已注册的工具列表
   */
  getRegisteredTools(): ToolInfo[] {
    return this.toolRegistry.getAllTools();
  }

  /**
   * 检查服务端是否运行中
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 获取工具实例
   */
  getTool(toolName: string): ITool | undefined {
    return this.toolRegistry.getTool(toolName);
  }

  /**
   * 检查工具是否已注册
   */
  hasToolRegistered(toolName: string): boolean {
    return this.toolRegistry.hasTool(toolName);
  }
  
  /**
   * 注册配置中指定的工具
   */
  private async registerConfiguredTools(): Promise<void> {
    try {
      logger.info(`Registering ${this.toolsToRegister.length} configured tools...`);
      
      for (const ToolClass of this.toolsToRegister) {
          const toolInstance = new ToolClass();
          this.registerTool(toolInstance);
      }
      
      logger.info(`Registered ${this.toolRegistry.getToolCount()} tools for this server.`);
      
    } catch (error) {
      logger.error('Failed to register configured tools', error);
      throw MCPError.initializationError('配置工具注册失败', error);
    }
  }

  /**
   * 执行工具调用
   */
  async executeTool(toolName: string, parameters: ToolParameters): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      const tool = this.toolRegistry.getTool(toolName);
      if (!tool) {
        throw MCPError.toolNotFound(toolName);
      }

      logger.toolCall(toolName, parameters);
      
      // 执行工具
      const result = await tool._call(parameters);
      
      const executionTime = Date.now() - startTime;
      result.executionTime = executionTime;
      
      // 记录工具使用
      this.toolRegistry.recordToolUsage(toolName);
      
      logger.toolResult(toolName, result.success, result.data, result.error);
      this.emit('toolExecuted', { toolName, parameters, result, executionTime });
      
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.toolResult(toolName, false, null, error);
      
      if (error instanceof MCPError) {
        throw error;
      }
      
      throw MCPError.executionError(`工具执行失败: ${toolName}`, error);
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
    
    logger.info('New client connected');
    this.connections.add(ws);
    this.emit('connection', ws);

    ws.on('message', (message: Buffer) => {
        this.handleClientMessage(message, ws);
    });

    ws.on('close', (code, reason) => {
        logger.info(`Client disconnected: code=${code}, reason=${reason.toString()}`);
        this.connections.delete(ws);
        this.emit('disconnection', ws);
    });

    ws.on('error', (error) => {
        logger.error('WebSocket client error', error);
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
   * 处理客户端消息
   */
  private handleClientMessage(message: Buffer, connection: WebSocket): void {
    let parsedMessage: MCPMessage;
    try {
      parsedMessage = JSON.parse(message.toString());
    } catch (error) {
        logger.error('Failed to parse client message', { message: message.toString(), error });
        this.sendErrorToClient(MCPError.parameterError('Invalid JSON format'), 'unknown', connection);
        return;
    }

    try {
      if (!MessageProcessor.validateMessage(parsedMessage)) {
        throw MCPError.parameterError('无效的消息格式');
      }
      
      switch (parsedMessage.type) {
        case MCPMessageType.PING:
          this.handlePingMessage(parsedMessage, connection);
          break;
        case MCPMessageType.TOOL_CALL:
          this.handleToolCallMessage(parsedMessage, connection);
          break;
        case MCPMessageType.LIST_TOOLS:
          this.handleListToolsMessage(parsedMessage, connection);
          break;
        default:
          logger.warn(`Unhandled message type: ${parsedMessage.type}`);
      }
      
    } catch (error) {
      logger.error('Error handling client message', error);
      this.sendErrorToClient(error, parsedMessage.id, connection);
    }
  }
  
  /**
   * 处理Ping消息
   */
  private handlePingMessage(message: MCPMessage, connection: WebSocket): void {
    const pongMessage = MessageProcessor.createPongMessage(message.id);
    this.sendMessageToClient(pongMessage, connection);
  }
  
  /**
   * 处理工具调用消息
   */
  private async handleToolCallMessage(message: MCPMessage, connection: WebSocket): Promise<void> {
    try {
      const { toolName, parameters } = message.payload as { toolName: string, parameters: ToolParameters };
      
      if (!toolName) {
        throw MCPError.parameterError('工具名称不能为空');
      }
      
      const result = await this.executeTool(toolName, parameters);
      
      const resultMessage = MessageProcessor.createToolResultMessage(toolName, result, message.id);
      this.sendMessageToClient(resultMessage, connection);
      
    } catch (error) {
      this.sendErrorToClient(error, message.id, connection);
    }
  }
  
  /**
   * 处理工具列表请求消息
   */
  private async handleListToolsMessage(message: MCPMessage, connection: WebSocket): Promise<void> {
    try {
      const tools = this.getRegisteredTools();
      const toolsListMessage = MessageProcessor.createToolsListMessage(tools, message.id);
      this.sendMessageToClient(toolsListMessage, connection);
      
    } catch (error) {
      this.sendErrorToClient(error, message.id, connection);
    }
  }
  
  /**
   * 发送消息到客户端
   */
  private sendMessageToClient(message: MCPMessage, connection: WebSocket): void {
    try {
      if (connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify(message));
        logger.debug(`Sending message to client: ${message.type}`);
      } else {
        logger.warn(`Could not send message, WebSocket connection state is ${connection.readyState}`);
      }
    } catch (error) {
      logger.error('Error sending message to client', error);
    }
  }
  
  /**
   * 发送错误消息到客户端
   */
  private sendErrorToClient(error: any, requestId: string, connection: WebSocket): void {
    try {
      const errorMessage = MessageProcessor.createErrorMessage(
        error instanceof Error ? error : new Error(String(error)),
        requestId
      );
      
      this.sendMessageToClient(errorMessage, connection);
      
    } catch (sendError) {
      logger.error('Error sending error message to client', sendError);
    }
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
      tools: this.toolRegistry.getToolCount(),
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
