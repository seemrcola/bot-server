/**
 * 统一日志系统
 * 重新导出MCP日志系统，提供统一的日志接口
 */

// 重新导出MCP日志系统的所有功能
export {
  createLogger,
  createMCPLogger,
  setGlobalLogger,
  type Logger,
  type MCPLogger
} from '../mcp/utils/logger.js';

// 为了向后兼容，保留LogLevel枚举
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}
