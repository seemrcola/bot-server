import type { ToolResult } from '../types.js'
import { createLogger } from '@/utils/logger.js'

const logger = createLogger('WebCatcherError')

/**
 * 错误类型枚举
 */
export enum ErrorCode {
    INVALID_URL = 'INVALID_URL',
    NETWORK_ERROR = 'NETWORK_ERROR',
    TIMEOUT = 'TIMEOUT',
    PARSING_ERROR = 'PARSING_ERROR',
    CONTENT_TOO_SHORT = 'CONTENT_TOO_SHORT',
    FORBIDDEN = 'FORBIDDEN',
    NOT_FOUND = 'NOT_FOUND',
    SERVER_ERROR = 'SERVER_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * 性能监控类
 */
export class PerformanceMonitor {
    private startTime: number

    constructor() {
        this.startTime = Date.now()
    }

    /**
     * 获取执行时间
     */
    getElapsedTime(): number {
        return Date.now() - this.startTime
    }

    /**
     * 重置计时器
     */
    reset(): void {
        this.startTime = Date.now()
    }
}

/**
 * 创建成功结果
 */
export function createSuccessResult<T>(
    data: T,
    metadata?: Partial<ToolResult['metadata']>,
): ToolResult<T> {
    return {
        success: true,
        data,
        metadata: {
            processingTime: 0,
            timestamp: new Date().toISOString(),
            ...metadata,
        },
    }
}

/**
 * 创建错误结果
 */
export function createErrorResult(
    step: string,
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    metadata?: Partial<ToolResult['metadata']>,
): ToolResult {
    logger.error(`[${step}] ${message}`, { code, metadata })

    return {
        success: false,
        error: {
            step,
            message,
            code,
        },
        metadata: {
            processingTime: 0,
            timestamp: new Date().toISOString(),
            ...metadata,
        },
    }
}

/**
 * 错误处理装饰器函数
 */
export function withErrorHandling<T extends any[], R>(
    stepName: string,
    fn: (...args: T) => Promise<ToolResult<R>>,
): (...args: T) => Promise<ToolResult<R>> {
    return async (...args: T): Promise<ToolResult<R>> => {
        const monitor = new PerformanceMonitor()

        try {
            logger.info(`[${stepName}] 开始执行`)
            const result = await fn(...args)

            const processingTime = monitor.getElapsedTime()
            logger.info(`[${stepName}] 执行完成，耗时: ${processingTime}ms`)

            // 更新处理时间
            if (result.metadata) {
                result.metadata.processingTime = processingTime
            }

            return result
        }
        catch (error) {
            const processingTime = monitor.getElapsedTime()
            const errorMessage = error instanceof Error ? error.message : String(error)

            logger.error(`[${stepName}] 执行失败: ${errorMessage}`, {
                error,
                processingTime,
                args: args.length > 0 ? args[0] : undefined,
            })

            // 根据错误类型确定错误代码
            let errorCode = ErrorCode.UNKNOWN_ERROR
            if (errorMessage.includes('timeout')) {
                errorCode = ErrorCode.TIMEOUT
            }
            else if (errorMessage.includes('network') || errorMessage.includes('ENOTFOUND')) {
                errorCode = ErrorCode.NETWORK_ERROR
            }
            else if (errorMessage.includes('403')) {
                errorCode = ErrorCode.FORBIDDEN
            }
            else if (errorMessage.includes('404')) {
                errorCode = ErrorCode.NOT_FOUND
            }
            else if (errorMessage.includes('5')) {
                errorCode = ErrorCode.SERVER_ERROR
            }

            return createErrorResult(
                stepName,
                errorMessage,
                errorCode,
                { processingTime },
            )
        }
    }
}

/**
 * 超时包装器
 */
export function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage = `操作超时 (${timeoutMs}ms)`,
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        }),
    ])
}

/**
 * 重试包装器
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delay = 1000,
): Promise<T> {
    let lastError: Error

    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await fn()
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))

            if (i === maxRetries) {
                throw lastError
            }

            // 指数退避延迟
            const waitTime = delay * 2 ** i
            logger.warn(`尝试 ${i + 1}/${maxRetries + 1} 失败，${waitTime}ms 后重试: ${lastError.message}`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
        }
    }

    throw (lastError! || new Error('未知错误'))
}
