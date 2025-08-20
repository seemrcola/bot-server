/**
 * 通用工具函数统一导出
 * 提供项目中所有通用工具函数的统一入口
 */

// 日志工具
export {
    createLogger,
    createMCPLogger,
    type Logger,
    LogLevel,
    type MCPLogger,
    setGlobalLogger,
} from './logger.js'

// 对象工具
export {
    deepClone,
    deepMerge,
    filterObject,
    flatten,
    isEmpty,
    isObject,
    mapObject,
    safeGet,
    safeSet,
} from './object-utils.js'
