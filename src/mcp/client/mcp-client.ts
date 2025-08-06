/**
 * MCP客户端实现
 */

import { WebSocket } from 'ws';
import { IMCPClient, ToolResult, ToolInfo, ToolParameters } from '../types/index.js';
import { MCPError } from '../utils/errors.js';
import { createMCPLogger } from '../utils/logger.js';
import { configManager } from '../config/manager.js';
import { EventEmitter } from 'events';

const logger = createMCPLogger('Client');

export interface MCPClientOptions {
  serverUrl: string;
  timeout?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  enableHeartbeat?: boolean;
  heartbeatInterval?: number;
}

export class MCPClient extends EventEmitter implements IMCPClient {
  private connected = false;
  private connecting = false;
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout | null;
  private heartbeatTimer?: NodeJS.Timeout | null;
  private options: Required<MCPClientOptions>;
  private connection: WebSocket | undefined;
  private pendingRequests = new Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void, timer: NodeJS.Timeout }>();
  private availableTools: ToolInfo[] = [];


  constructor(options?: Partial<MCPClientOptions>) {
    super();
    
    // 从配置中心获取默认配置
    const clientConfig = configManager.getConfig().client;
    
    this.options = {
      serverUrl: clientConfig.serverUrl,
      timeout: clientConfig.timeout,
      reconnectDelay: clientConfig.reconnectDelay,
      maxReconnectAttempts: clientConfig.maxReconnectAttempts,
      enableHeartbeat: true,
      heartbeatInterval: 30000,
      ...options
    };
  }

  /**
   * 重新连接
   */
  private async reconnect(): Promise<void> {
    try {
      await this.disconnect();
      await this.connect();
    } catch (error) {
      logger.error('重新连接失败', error);
    }
  }

  /**
   * 连接到MCP服务端
   */
  async connect(): Promise<void> {
    if (this.connected || this.connecting) {
      logger.info('Already connected or connecting');
      return;
    }

    try {
      this.connecting = true;
      logger.info(`Connecting to MCP server: ${this.options.serverUrl}`);
      
      await this.establishConnection();
      
      this.connecting = false;
      
    } catch (error) {
      this.connecting = false;
      this.connection = undefined;
      logger.error('Failed to connect to MCP server', error);
      
      // 尝试重连
      if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
        this.scheduleReconnect();
      } else {
        this.emit('connectionFailed', error);
        throw MCPError.connectionError('连接MCP服务端失败', error);
      }
    }
  }

  /**
   * 断开与MCP服务端的连接
   */
  async disconnect(): Promise<void> {
    try {
      if (!this.connected && !this.connecting) {
        return;
      }

      logger.info('Disconnecting from MCP server');
      
      // 清理定时器
      this.clearTimers();
      
      // 关闭连接
      if (this.connection) {
        this.connection.close(1000, 'Client initiated disconnect');
        this.connection = undefined;
      }
      
      this.connected = false;
      this.connecting = false;
      this.reconnectAttempts = 0;
      
      this.emit('disconnected');
      logger.connectionStatus('disconnected');
      
    } catch (error) {
      logger.error('Error disconnecting from MCP server', error);
      throw MCPError.connectionError('断开MCP服务端连接失败', error);
    }
  }

  /**
   * 调用工具
   */
  async callTool(toolName: string, parameters: ToolParameters): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      if (!this.connected || !this.connection) {
        throw MCPError.connectionError('MCP客户端未连接');
      }

      logger.toolCall(toolName, parameters);
      
      const messageId = this.generateUniqueId();
      const message = {
        id: messageId,
        type: 'TOOL_CALL',
        timestamp: Date.now(),
        payload: { toolName, parameters },
      };

      this.connection.send(JSON.stringify(message));

      // 等待服务端响应
      const response = await this.waitForResponse(messageId);

      const executionTime = Date.now() - startTime;
      
      // 解析服务器响应 - response 是 payload，包含 { toolName, result }
      const toolResult: ToolResult = response.result;
      toolResult.executionTime = executionTime;

      logger.toolResult(toolName, toolResult.success, toolResult.data);
      return toolResult;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.toolResult(toolName, false, null, error);
      
      if (error instanceof MCPError) {
        throw error;
      }
      
      throw MCPError.executionError(`工具调用失败: ${toolName}`, error);
    }
  }

  /**
   * 获取可用工具列表
   */
  async listTools(): Promise<ToolInfo[]> {
    try {
      if (!this.connected || !this.connection) {
        throw MCPError.connectionError('MCP客户端未连接');
      }

      const messageId = this.generateUniqueId();
      const message = {
        id: messageId,
        type: 'LIST_TOOLS',
        timestamp: Date.now(),
        payload: {},
      };

      this.connection.send(JSON.stringify(message));

      // 等待服务端响应
      const result = await this.waitForResponse(messageId);
      
      this.availableTools = result.tools || [];
      return this.availableTools;
      
    } catch (error) {
      logger.error('Failed to list tools', error);
      if (error instanceof MCPError) {
        throw error;
      }
      throw MCPError.executionError('获取工具列表失败', error);
    }
  }

  /**
   * 根据名称获取单个工具的信息
   * @param toolName - The name of the tool to get info for.
   * @returns {ToolInfo | undefined} The tool info or undefined if not found.
   */
  getToolInfo(toolName: string): ToolInfo | undefined {
    return this.availableTools.find(tool => tool.name === toolName);
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 建立连接
   */
  private async establishConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Establishing connection to ${this.options.serverUrl}`);
        this.connection = new WebSocket(this.options.serverUrl);

        const onOpen = () => {
          this.connected = true;
          this.connecting = false;
          this.reconnectAttempts = 0;
          this.setupHeartbeat();
          this.emit('connected');
          logger.connectionStatus('connected', { serverUrl: this.options.serverUrl });
          cleanup();
          resolve();
        };

        const onError = (error: Error) => {
          logger.error('WebSocket connection error', error);
          this.connected = false;
          this.connecting = false;
          cleanup();
          reject(MCPError.connectionError('建立连接失败', error));
        };

        const onClose = (code: number, reason: Buffer) => {
            if (this.connected) { // Was connected before
                this.handleConnectionLost();
            }
        };

        const onMessage = (data: Buffer) => {
          this.handleServerMessage(data);
        };

        const cleanup = () => {
          this.connection?.removeListener('open', onOpen);
          this.connection?.removeListener('error', onError);
          this.connection?.removeListener('close', onClose);
        };
        
        this.connection.on('open', onOpen);
        this.connection.on('error', onError);
        this.connection.on('close', onClose);
        this.connection.on('message', onMessage);

      } catch (error) {
        reject(MCPError.connectionError('建立连接失败', error));
      }
    });
  }

  private handleServerMessage(data: Buffer) {
    try {
      const message = JSON.parse(data.toString());
      if (message.id && this.pendingRequests.has(message.id)) {
        const { resolve, reject, timer } = this.pendingRequests.get(message.id)!;
        clearTimeout(timer);

        if (message.type === 'ERROR') {
          reject(MCPError.fromPayload(message.payload));
        } else {
          resolve(message.payload);
        }
        this.pendingRequests.delete(message.id);
      } else if (message.type === 'PONG') {
        logger.debug('Received pong from server');
      }
    } catch (error) {
      logger.error('Failed to handle server message', error);
    }
  }


  private generateUniqueId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private waitForResponse(messageId: string): Promise<any> {
      return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
              this.pendingRequests.delete(messageId);
              reject(MCPError.timeoutError('Request timed out'));
          }, this.options.timeout);

          this.pendingRequests.set(messageId, { resolve, reject, timer });
      });
  }


  /**
   * 执行握手
   */
  private async performHandshake(): Promise<void> {
    try {
      logger.info('Performing handshake');
      
      // 简化实现：模拟握手过程
      // 在实际实现中，这里会发送握手消息并等待响应
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error) {
      throw MCPError.connectionError('握手失败', error);
    }
  }

  /**
   * 设置心跳
   */
  private setupHeartbeat(): void {
    if (!this.options.enableHeartbeat) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.connected) {
        this.sendHeartbeat().catch(error => {
          logger.warn('Heartbeat failed', error);
          this.handleConnectionLost();
        });
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * 发送心跳
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      if (this.connection && this.connection.readyState === WebSocket.OPEN) {
        const pingMessage = { id: this.generateUniqueId(), type: 'PING', timestamp: Date.now(), payload: {} };
        this.connection.send(JSON.stringify(pingMessage));
        logger.debug('Sending heartbeat (ping)');
      } else {
        throw new Error('Connection not open');
      }
    } catch (error) {
      throw MCPError.connectionError('心跳发送失败', error);
    }
  }

  /**
   * 处理连接丢失
   */
  private handleConnectionLost(): void {
    if (!this.connected) {
      return;
    }

    logger.warn('Connection lost, attempting to reconnect');
    this.connected = false;
    this.emit('connectionLost');
    
    if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      this.emit('connectionFailed', MCPError.connectionError('Max reconnect attempts reached'));
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts}`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        logger.error('Reconnect attempt failed', error);
      });
    }, this.options.reconnectDelay);
  }

  /**
   * 清理定时器
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 关闭连接
   */
  private async closeConnection(): Promise<void> {
    try {
      if (this.connection) {
        this.connection.close(1000, 'Client initiated disconnect');
        this.connection = undefined;
      }
    } catch (error) {
      throw MCPError.connectionError('关闭连接失败', error);
    }
  }

  /**
   * 获取连接状态信息
   */
  getConnectionInfo(): {
    connected: boolean;
    serverUrl: string;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
  } {
    return {
      connected: this.connected,
      serverUrl: this.options.serverUrl,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.options.maxReconnectAttempts
    };
  }

  /**
   * 重置连接状态
   */
  reset(): void {
    this.clearTimers();
    this.connected = false;
    this.connecting = false;
    this.reconnectAttempts = 0;
    this.connection = undefined;
  }

  getServerUrl(): string {
    return this.options.serverUrl;
  }

  /**
   * 销毁客户端，清理所有资源
   */
  destroy(): void {
    // 断开连接
    this.disconnect().catch(error => {
      logger.error('销毁时断开连接失败', error);
    });

    // 重置状态
    this.reset();

    logger.info('MCP Client已销毁');
  }
}
