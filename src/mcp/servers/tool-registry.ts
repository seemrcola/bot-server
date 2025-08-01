/**
 * 工具注册表
 * 管理MCP服务端可用的工具
 */

import { ITool, ToolInfo } from '../types/index.js';
import { MCPError } from '../utils/errors.js';
import { createMCPLogger } from '../utils/logger.js';
import { EventEmitter } from 'events';

const logger = createMCPLogger('ToolRegistry');

export class ToolRegistry extends EventEmitter {
  private tools = new Map<string, ITool>();
  private usageStats = new Map<string, { count: number, lastUsed?: Date }>();

  constructor() {
    super();
  }

  /**
   * 注册工具
   */
  registerTool(tool: ITool): void {
    try {
      if (!tool.name) {
        throw MCPError.parameterError('工具名称不能为空');
      }

      logger.info(`Registering tool: ${tool.name}`);
      
      if (this.tools.has(tool.name)) {
        logger.warn(`Tool ${tool.name} is already registered, overwriting`);
      }
      
      this.tools.set(tool.name, tool);
      this.usageStats.set(tool.name, { count: 0 });
      
      this.emit('tool-registered', tool.name);
      logger.info(`Tool ${tool.name} registered successfully`);
      
    } catch (error) {
      logger.error(`Failed to register tool: ${tool?.name || 'unknown'}`, error);
      throw MCPError.initializationError('工具注册失败', error);
    }
  }

  /**
   * 注销工具
   */
  unregisterTool(toolName: string): void {
    try {
      if (!this.tools.has(toolName)) {
        logger.warn(`Tool ${toolName} is not registered`);
        return;
      }
      
      this.tools.delete(toolName);
      this.usageStats.delete(toolName);
      
      this.emit('tool-unregistered', toolName);
      logger.info(`Tool ${toolName} unregistered`);
      
    } catch (error) {
      logger.error(`Failed to unregister tool: ${toolName}`, error);
      throw MCPError.initializationError('工具注销失败', error);
    }
  }

  /**
   * 获取工具
   */
  getTool(toolName: string): ITool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * 检查工具是否已注册
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * 获取所有已注册工具的信息
   */
  getAllTools(): ToolInfo[] {
    const toolInfos: ToolInfo[] = [];
    
    for (const [name, tool] of Array.from(this.tools.entries())) {
      const stats = this.usageStats.get(name) || { count: 0 };
      
      toolInfos.push({
        name: tool.name,
        description: tool.description,
        version: '1.0.0', // 可以从工具中获取版本信息
        parameters: tool.parameters,
        enabled: true,
        lastUsed: stats.lastUsed || new Date(),
        usageCount: stats.count
      });
    }
    
    return toolInfos;
  }

  /**
   * 记录工具使用
   */
  recordToolUsage(toolName: string): void {
    if (!this.tools.has(toolName)) {
      return;
    }
    
    const stats = this.usageStats.get(toolName) || { count: 0 };
    stats.count += 1;
    stats.lastUsed = new Date();
    
    this.usageStats.set(toolName, stats);
    this.emit('tool-used', toolName, stats);
  }

  /**
   * 获取工具使用统计
   */
  getToolUsageStats(toolName: string): { count: number, lastUsed?: Date } | undefined {
    return this.usageStats.get(toolName);
  }

  /**
   * 获取已注册工具数量
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * 清除所有工具
   */
  clearAllTools(): void {
    this.tools.clear();
    this.usageStats.clear();
    this.emit('registry-cleared');
    logger.info('Tool registry cleared');
  }
}
