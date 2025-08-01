/**
 * 日志适配器
 * 用于连接MCP模块和外部日志系统
 */

import { Logger, setGlobalLogger } from '../utils/logger.js';

/**
 * 外部日志系统适配器
 */
export class LoggerAdapter implements Logger {
  constructor(private externalLogger: any) {}

  info(message: string, details?: any): void {
    this.externalLogger.info(message, details);
  }

  error(message: string, error?: any, details?: any): void {
    this.externalLogger.error(message, error, details);
  }

  warn(message: string, details?: any): void {
    this.externalLogger.warn?.(message, details) || this.externalLogger.info(`[WARN] ${message}`, details);
  }

  debug(message: string, details?: any): void {
    this.externalLogger.debug?.(message, details) || this.externalLogger.info(`[DEBUG] ${message}`, details);
  }

  performance(operation: string, duration: number, details?: any): void {
    if (this.externalLogger.performance) {
      this.externalLogger.performance(operation, duration, details);
    } else {
      this.info(`Performance: ${operation} took ${duration}ms`, details);
    }
  }
}

/**
 * 初始化MCP日志系统
 * @param externalLogger 外部日志实例
 */
export function initializeMCPLogger(externalLogger?: any): void {
  if (externalLogger) {
    const adapter = new LoggerAdapter(externalLogger);
    setGlobalLogger(adapter);
  }
  // 如果没有提供外部日志，则使用默认的控制台日志
}