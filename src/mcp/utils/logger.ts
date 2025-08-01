/**
 * MCP模块专用日志工具
 * 独立的日志实现，不依赖外部模块
 */

/**
 * 日志接口定义
 */
export interface Logger {
  info(message: string, details?: any): void;
  error(message: string, error?: any, details?: any): void;
  warn(message: string, details?: any): void;
  debug(message: string, details?: any): void;
  performance?(operation: string, duration: number, details?: any): void;
}

/**
 * 默认控制台日志实现
 */
class ConsoleLogger implements Logger {
  constructor(private prefix: string) {}

  info(message: string, details?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [INFO] [${this.prefix}] ${message}`;
    if (details) {
      console.log(logMessage, details);
    } else {
      console.log(logMessage);
    }
  }

  error(message: string, error?: any, details?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [ERROR] [${this.prefix}] ${message}`;
    if (error && details) {
      console.error(logMessage, error, details);
    } else if (error) {
      console.error(logMessage, error);
    } else {
      console.error(logMessage);
    }
  }

  warn(message: string, details?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [WARN] [${this.prefix}] ${message}`;
    if (details) {
      console.warn(logMessage, details);
    } else {
      console.warn(logMessage);
    }
  }

  debug(message: string, details?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [DEBUG] [${this.prefix}] ${message}`;
    if (details) {
      console.debug(logMessage, details);
    } else {
      console.debug(logMessage);
    }
  }

  performance(operation: string, duration: number, details?: any): void {
    this.info(`Performance: ${operation} took ${duration}ms`, details);
  }
}

/**
 * 全局日志配置
 */
let globalLogger: Logger | null = null;

/**
 * 设置全局日志实现
 */
export function setGlobalLogger(logger: Logger): void {
  globalLogger = logger;
}

/**
 * MCP 扩展日志接口
 */
export interface MCPLogger extends Logger {
  toolCall: (toolName: string, parameters: any, duration?: number) => void;
  toolResult: (toolName: string, success: boolean, result?: any, error?: any) => void;
  nlpAnalysis: (message: string, result: any) => void;
  connectionStatus: (status: 'connected' | 'disconnected' | 'reconnecting', details?: any) => void;
  performance: (operation: string, duration: number, details?: any) => void;
}

/**
 * 创建通用日志记录器（兼容性函数）
 */
export function createLogger(module: string): Logger {
  return globalLogger || new ConsoleLogger(module);
}

/**
 * 创建MCP专用的日志记录器
 */
export function createMCPLogger(module: string): MCPLogger {
  const baseLogger = globalLogger || new ConsoleLogger(`MCP:${module}`);
  
  return {
    info: baseLogger.info.bind(baseLogger),
    error: baseLogger.error.bind(baseLogger),
    warn: baseLogger.warn.bind(baseLogger),
    debug: baseLogger.debug.bind(baseLogger),
    

    
    /**
     * 记录工具调用日志
     */
    toolCall: (toolName: string, parameters: any, duration?: number) => {
      baseLogger.info(`Tool call: ${toolName}`, {
        tool: toolName,
        parameters,
        duration: duration ? `${duration}ms` : undefined,
        timestamp: new Date().toISOString()
      });
    },

    /**
     * 记录工具执行结果
     */
    toolResult: (toolName: string, success: boolean, result?: any, error?: any) => {
      if (success) {
        baseLogger.info(`Tool success: ${toolName}`, {
          tool: toolName,
          result: typeof result === 'object' ? JSON.stringify(result) : result
        });
      } else {
        baseLogger.error(`Tool failed: ${toolName}`, error, {
          tool: toolName,
          result
        });
      }
    },

    /**
     * 记录NLP分析结果
     */
    nlpAnalysis: (message: string, result: any) => {
      baseLogger.debug('NLP analysis result', {
        message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        result
      });
    },

    /**
     * 记录连接状态变化
     */
    connectionStatus: (status: 'connected' | 'disconnected' | 'reconnecting', details?: any) => {
      baseLogger.info(`Connection status: ${status}`, details);
    },

    /**
     * 记录性能指标
     */
    performance: (operation: string, duration: number, details?: any) => {
      if (baseLogger.performance) {
        baseLogger.performance(operation, duration, details);
      } else {
        baseLogger.info(`Performance: ${operation} took ${duration}ms`, details);
      }
    }
  };
}
