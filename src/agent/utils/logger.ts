// src/utils/logger.ts
export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
}

export interface Logger {
    debug: (message: string, ...args: any[]) => void
    info: (message: string, ...args: any[]) => void
    warn: (message: string, ...args: any[]) => void
    error: (message: string, ...args: any[]) => void
}

// 简单的全局日志级别控制
let currentLogLevel: LogLevel = (process.env['LOG_LEVEL'] as LogLevel) || LogLevel.INFO

export function setGlobalLogger(level: LogLevel) {
    currentLogLevel = level
}

function shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]
    return levels.indexOf(level) >= levels.indexOf(currentLogLevel)
}

export function createLogger(moduleName: string): Logger {
    return {
        debug: (message: string, ...args: any[]) => {
            if (shouldLog(LogLevel.DEBUG)) {
                console.debug(`[${new Date().toISOString()}] [DEBUG] [${moduleName}] ${message}`, ...args)
            }
        },
        info: (message: string, ...args: any[]) => {
            if (shouldLog(LogLevel.INFO)) {
                console.info(`[${new Date().toISOString()}] [INFO] [${moduleName}] ${message}`, ...args)
            }
        },
        warn: (message: string, ...args: any[]) => {
            if (shouldLog(LogLevel.WARN)) {
                console.warn(`[${new Date().toISOString()}] [WARN] [${moduleName}] ${message}`, ...args)
            }
        },
        error: (message: string, ...args: any[]) => {
            if (shouldLog(LogLevel.ERROR)) {
                console.error(`[${new Date().toISOString()}] [ERROR] [${moduleName}] ${message}`, ...args)
            }
        },
    }
}

// 为了兼容旧代码，保留 createMCPLogger 和 MCPLogger 类型
export const createMCPLogger = createLogger
export type MCPLogger = Logger
