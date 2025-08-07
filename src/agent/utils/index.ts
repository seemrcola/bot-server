/**
 * 通用工具函数统一导出
 * 提供项目中所有通用工具函数的统一入口
 */

// 日志工具
export {
  createLogger,
  createMCPLogger,
  setGlobalLogger,
  LogLevel,
  type Logger,
  type MCPLogger
} from './logger.js';

// 对象工具
export {
  deepMerge,
  isObject,
  deepClone,
  safeGet,
  safeSet,
  filterObject,
  mapObject,
  isEmpty,
  flatten
} from './object-utils.js';
