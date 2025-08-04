/**
 * 工具基类
 * 所有MCP工具的基础实现
 */

import { ITool, ToolParameters, ToolResult, ToolInfo } from '../types/index.js';
import { createMCPLogger } from '../utils/logger.js';
import { MCPError } from '../utils/errors.js';

export abstract class BaseTool implements ITool {
  public readonly name: string;
  public readonly description: string;
  public readonly keywords?: string[];
  public readonly parameters: ToolInfo['parameters'];
  protected readonly logger;

  constructor(
    name: string,
    description: string,
    parameters: ToolInfo['parameters'],
    keywords?: string[]
  ) {
    this.name = name;
    this.description = description;
    if (keywords !== undefined) {
      this.keywords = keywords;
    }
    this.parameters = parameters;
    this.logger = createMCPLogger(`Tool:${name}`);
  }

  public async execute(params: ToolParameters): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      this.logger.info(`Executing tool with params`, params);
      const result = await this._execute(params);
      const executionTime = Date.now() - startTime;
      
      this.logger.info(`Tool executed successfully in ${executionTime}ms`);
      return { ...result, executionTime };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Tool execution failed in ${executionTime}ms`, error);
      
      if (error instanceof MCPError) {
        throw error;
      }
      throw MCPError.toolExecutionError(this.name, error);
    }
  }

  protected abstract _execute(params: ToolParameters): Promise<ToolResult>;

  /**
   * 实现ITool接口的_call方法
   */
  async _call(args: ToolParameters): Promise<ToolResult> {
    return this.execute(args);
  }

  /**
   * 验证参数
   */
  protected validateParameters(parameters: ToolParameters): void {
    // 检查必需参数
    if (this.parameters.required) {
      for (const requiredParam of this.parameters.required) {
        if (!(requiredParam in parameters)) {
          throw MCPError.parameterError(`缺少必需参数: ${requiredParam}`);
        }
      }
    }

    // 验证参数类型
    for (const [paramName, paramValue] of Object.entries(parameters)) {
      const paramSchema = this.parameters.properties[paramName];
      if (paramSchema && !this.validateParameterType(paramValue, paramSchema.type)) {
        throw MCPError.parameterError(`参数 ${paramName} 类型错误，期望: ${paramSchema.type}`);
      }
    }
  }

  /**
   * 验证参数类型
   */
  protected validateParameterType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null;
      case 'array':
        return Array.isArray(value);
      default:
        return true; // 未知类型，跳过验证
    }
  }

  /**
   * 创建成功结果
   */
  protected createSuccessResult(data: any): ToolResult {
    return {
      success: true,
      data
    };
  }

  /**
   * 创建失败结果
   */
  protected createErrorResult(error: Error | string): ToolResult {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    return {
      success: false,
      error: errorMessage
    };
  }

  /**
   * 获取工具信息
   */
  getInfo(): { name: string; description: string; keywords?: string[]; parameters: ToolInfo['parameters'] } {
    const info: { name: string; description: string; keywords?: string[]; parameters: ToolInfo['parameters'] } = {
      name: this.name,
      description: this.description,
      parameters: this.parameters
    };
    
    if (this.keywords !== undefined) {
      info.keywords = this.keywords;
    }
    
    return info;
  }
}
