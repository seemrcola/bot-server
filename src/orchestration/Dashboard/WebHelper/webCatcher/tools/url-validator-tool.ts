import type { ToolResult, UrlValidationResult, UrlValidatorInput } from '../types.js'
import urlParse from 'url-parse'
import { createLogger } from '@/utils/logger.js'
import { UrlValidatorSchema } from '../types.js'
import {
    createErrorResult,
    createSuccessResult,
    ErrorCode,
    withErrorHandling,
    withTimeout,
} from '../utils/error-handler.js'

const logger = createLogger('UrlValidatorTool')

/**
 * 允许的协议
 */
const ALLOWED_PROTOCOLS = ['http:', 'https:']

/**
 * URL验证工具类
 */
export class UrlValidatorTool {
    /**
     * 获取工具注册信息
     */
    static getToolDefinition() {
        return {
            name: 'urlValidator',
            schema: {
                title: 'URL验证工具',
                description: '验证URL的有效性和可访问性，支持格式检查、协议验证和网络连通性测试',
                inputSchema: UrlValidatorSchema.shape,
            },
            handler: this.handleToolCall.bind(this),
        }
    }

    /**
     * 工具调用处理器
     */
    static async handleToolCall(params: any) {
        const logger = createLogger('UrlValidatorTool')
        logger.info('调用URL验证工具', { url: params.url })
        const result = await this.validateUrl(params)

        if (result.success) {
            return {
                content: [{
                    type: 'text',
                    text: `URL验证成功：${result.data!.normalizedUrl}，协议：${result.data!.protocol}，域名：${result.data!.domain}，安全：${result.data!.isSecure ? '是' : '否'}`,
                }],
                structuredContent: result.data as any,
            }
        }
        else {
            return {
                content: [{
                    type: 'text',
                    text: `URL验证失败：${result.error!.message}`,
                }],
                error: result.error,
            }
        }
    }

    /**
     * 验证URL可达性
     */
    static async validateUrl(input: UrlValidatorInput): Promise<ToolResult<any>> {
        return withErrorHandling('URL验证', async () => {
            const { url, allowRedirects = true, timeout = 30000 } = input

            logger.info(`开始验证URL可达性: ${url}`)

            // 1. 基础格式验证
            const parseResult = this.parseUrl(url)
            if (!parseResult.success) {
                return parseResult
            }

            const parsed = parseResult.data!

            // 2. 网络可达性检查
            const reachabilityResult = await this.checkReachability(
                parsed.normalizedUrl,
                allowRedirects,
                timeout,
            )

            if (!reachabilityResult.success) {
                return reachabilityResult
            }

            logger.info(`URL可达性验证成功: ${parsed.normalizedUrl}`)

            return createSuccessResult(parsed, {
                url: parsed.normalizedUrl,
            })
        })()
    }

    /**
     * 解析URL
     */
    private static parseUrl(url: string): ToolResult<UrlValidationResult> {
        try {
            // 处理缺少协议的情况
            let normalizedUrl = url.trim()
            if (!normalizedUrl.match(/^https?:\/\//i)) {
                normalizedUrl = `https://${normalizedUrl}`
            }

            const parsed = urlParse(normalizedUrl, true)

            // 检查协议
            if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
                return createErrorResult(
                    'URL解析',
                    `不支持的协议: ${parsed.protocol}，仅支持 HTTP 和 HTTPS`,
                    ErrorCode.INVALID_URL,
                )
            }

            // 检查域名
            if (!parsed.hostname) {
                return createErrorResult(
                    'URL解析',
                    '无效的域名',
                    ErrorCode.INVALID_URL,
                )
            }

            const result: UrlValidationResult = {
                isValid: true,
                normalizedUrl,
                protocol: parsed.protocol,
                domain: parsed.hostname,
                isSecure: parsed.protocol === 'https:',
            }

            return createSuccessResult(result)
        }
        catch (error) {
            return createErrorResult(
                'URL解析',
                `URL格式无效: ${error instanceof Error ? error.message : String(error)}`,
                ErrorCode.INVALID_URL,
            )
        }
    }

    /**
     * 网络可达性检查
     */
    private static async checkReachability(
        url: string,
        allowRedirects: boolean,
        timeout: number,
    ): Promise<ToolResult<{ isValid: boolean }>> {
        try {
            const response = await withTimeout(
                fetch(url, {
                    method: 'HEAD',
                    redirect: allowRedirects ? 'follow' : 'manual',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; WebCatcher/1.0)',
                    },
                }),
                timeout,
            )

            // 检查响应状态
            if (response.status >= 400) {
                let errorCode = ErrorCode.UNKNOWN_ERROR
                if (response.status === 403) {
                    errorCode = ErrorCode.FORBIDDEN
                }
                else if (response.status === 404) {
                    errorCode = ErrorCode.NOT_FOUND
                }
                else if (response.status >= 500) {
                    errorCode = ErrorCode.SERVER_ERROR
                }

                return createErrorResult(
                    '可达性检查',
                    `HTTP错误: ${response.status} ${response.statusText}`,
                    errorCode,
                )
            }

            return createSuccessResult({ isValid: true })
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)

            let errorCode = ErrorCode.NETWORK_ERROR
            if (errorMessage.includes('timeout')) {
                errorCode = ErrorCode.TIMEOUT
            }

            return createErrorResult(
                '可达性检查',
                `网络请求失败: ${errorMessage}`,
                errorCode,
            )
        }
    }
}
