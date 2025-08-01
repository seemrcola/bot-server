/**
 * MCP模块错误类型定义
 */

export enum MCPErrorCode {
  // 通用错误
  UNKNOWN = 'UNKNOWN',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  PARAMETER_INVALID = 'PARAMETER_INVALID',
  TIMEOUT = 'TIMEOUT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  // 连接错误
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_LOST = 'CONNECTION_LOST',
  NOT_CONNECTED = 'NOT_CONNECTED',

  // 工具相关错误
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',

  // NLP 相关错误
  NLP_PROCESSING_FAILED = 'NLP_PROCESSING_FAILED',

  // 配置错误
  CONFIG_INVALID = 'CONFIG_INVALID',
}

export interface MCPErrorPayload {
  code: MCPErrorCode;
  message: string;
  details?: any;
  statusCode?: number;
}

export class MCPError extends Error {
  public readonly code: MCPErrorCode;
  public readonly details?: any;
  public readonly statusCode?: number;

  constructor(code: MCPErrorCode, message: string, details?: any, statusCode?: number) {
    super(message);
    this.name = 'MCPError';
    
    // 确保错误堆栈正确显示
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPError);
    }
    this.code = code;
    this.details = details;
    if (statusCode !== undefined) {
      this.statusCode = statusCode;
    }
  }

  /**
   * 从错误载荷创建MCPError实例
   */
  static fromPayload(payload: { code: string; message: string; details?: any; statusCode?: number }): MCPError {
    const code = payload.code as MCPErrorCode;
    return new MCPError(code, payload.message, payload.details, payload.statusCode);
  }

  /**
   * 工具未找到错误
   */
  static toolNotFound(toolName: string): MCPError {
    return new MCPError(MCPErrorCode.TOOL_NOT_FOUND, `工具 '${toolName}' 未找到`);
  }

  /**
   * 工具执行失败错误
   */
  static toolExecutionError(toolName: string, error: any): MCPError {
    return new MCPError(MCPErrorCode.TOOL_EXECUTION_FAILED, `工具 '${toolName}' 执行失败`, error);
  }

  /**
   * 初始化失败错误
   */
  static initializationError(message: string, error?: any): MCPError {
    return new MCPError(MCPErrorCode.INITIALIZATION_FAILED, message, error);
  }

  /**
   * 执行失败错误
   */
  static executionError(message: string, error?: any): MCPError {
    return new MCPError(MCPErrorCode.EXECUTION_FAILED, message, error);
  }

  /**
   * 参数错误
   */
  static parameterError(message: string, details?: any): MCPError {
    return new MCPError(MCPErrorCode.PARAMETER_INVALID, message, details);
  }

  /**
   * 连接错误
   */
  static connectionError(message: string, error?: any): MCPError {
    return new MCPError(MCPErrorCode.CONNECTION_FAILED, message, error);
  }

  /**
   * 超时错误
   */
  static timeoutError(message: string): MCPError {
    return new MCPError(MCPErrorCode.TIMEOUT, message);
  }

  /**
   * 内部错误
   */
  static internalError(message: string, error?: any): MCPError {
    return new MCPError(MCPErrorCode.INTERNAL_ERROR, message, error);
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserFriendlyMessage(): string {
    switch (this.code) {
      case MCPErrorCode.TOOL_NOT_FOUND:
        return this.message;
      case MCPErrorCode.TOOL_EXECUTION_FAILED:
        return '工具执行时发生内部错误，请联系管理员。';
      case MCPErrorCode.CONNECTION_FAILED:
        return '无法连接到服务，请检查网络连接。';
      case MCPErrorCode.TIMEOUT:
        return '请求超时，请稍后重试。';
      case MCPErrorCode.PARAMETER_INVALID:
        return `请求参数不正确: ${this.message}`;
      case MCPErrorCode.INTERNAL_ERROR:
        return `系统内部错误: ${this.message}`;
      default:
        return '系统发生未知错误，请稍后重试。';
    }
  }
}
