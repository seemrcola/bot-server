import type { Browser, Page } from 'puppeteer'
import type { HtmlFetcherInput, HtmlFetchResult, ToolResult } from '../types.js'
import puppeteer from 'puppeteer'
import { createLogger } from '@/utils/logger.js'
import { HtmlFetcherSchema } from '../types.js'
import {
    createErrorResult,
    createSuccessResult,
    ErrorCode,
    withErrorHandling,
    withTimeout,
} from '../utils/error-handler.js'

const logger = createLogger('HtmlFetcherTool')

/**
 * HTML获取工具类
 */
export class HtmlFetcherTool {
    private static browser: Browser | null = null

    /**
     * 获取工具注册信息
     */
    static getToolDefinition() {
        return {
            name: 'htmlFetcher',
            schema: {
                title: 'HTML内容获取工具',
                description: '获取网页的HTML内容，支持静态和动态网页抓取，可处理JavaScript渲染的页面',
                inputSchema: HtmlFetcherSchema.shape,
            },
            handler: this.handleToolCall.bind(this),
        }
    }

    /**
     * 工具调用处理器
     */
    static async handleToolCall(params: any) {
        const logger = createLogger('HtmlFetcherTool')
        logger.info('调用HTML获取工具', { url: params.url })
        const result = await this.fetchHtml(params)

        if (result.success) {
            const data = result.data!
            return {
                content: [{
                    type: 'text',
                    text: `HTML获取成功：最终URL: ${data.finalUrl}，状态码: ${data.statusCode}，大小: ${data.metadata.size} 字符`,
                }],
                structuredContent: data as any,
            }
        }
        else {
            return {
                content: [{
                    type: 'text',
                    text: `HTML获取失败：${result.error!.message}`,
                }],
                error: result.error,
            }
        }
    }

    /**
     * 获取网页HTML内容
     */
    static async fetchHtml(input: HtmlFetcherInput): Promise<ToolResult<HtmlFetchResult>> {
        return withErrorHandling('HTML获取', async () => {
            const {
                url,
                useHeadless = false,
                timeout = 30000,
                waitForSelector,
                userAgent,
            } = input

            logger.info(`开始获取HTML: ${url}${useHeadless ? ' (使用无头浏览器)' : ''}`)

            if (useHeadless) {
                return await this.fetchWithPuppeteer(url, timeout, waitForSelector, userAgent)
            }
            else {
                return await this.fetchWithFetch(url, timeout, userAgent)
            }
        })()
    }

    /**
     * 使用fetch获取静态HTML
     */
    private static async fetchWithFetch(
        url: string,
        timeout: number,
        userAgent?: string,
    ): Promise<ToolResult<HtmlFetchResult>> {
        const startTime = Date.now()

        try {
            const headers: Record<string, string> = {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
            }

            if (userAgent) {
                headers['User-Agent'] = userAgent
            }
            else {
                headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }

            const response = await withTimeout(
                fetch(url, {
                    method: 'GET',
                    headers,
                    redirect: 'follow',
                }),
                timeout,
            )

            if (!response.ok) {
                return createErrorResult(
                    'HTTP请求',
                    `HTTP错误: ${response.status} ${response.statusText}`,
                    response.status === 403
                        ? ErrorCode.FORBIDDEN
                        : response.status === 404
                            ? ErrorCode.NOT_FOUND
                            : response.status >= 500 ? ErrorCode.SERVER_ERROR : ErrorCode.NETWORK_ERROR,
                )
            }

            const html = await response.text()
            const loadTime = Date.now() - startTime

            // 解析内容类型
            const contentType = response.headers.get('content-type') || 'text/html'

            // 提取基础元数据
            const metadata = this.extractBasicMetadata(html)

            const result: HtmlFetchResult = {
                html,
                contentType,
                statusCode: response.status,
                finalUrl: response.url,
                loadTime,
                isStatic: true,
                metadata: {
                    ...metadata,
                    size: html.length,
                },
            }

            logger.info(`静态HTML获取成功: ${result.finalUrl}, 大小: ${result.metadata.size} 字符, 耗时: ${loadTime}ms`)

            return createSuccessResult(result, {
                url: result.finalUrl,
                contentLength: result.metadata.size,
            })
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)

            return createErrorResult(
                'HTTP请求',
                `获取HTML失败: ${errorMessage}`,
                errorMessage.includes('timeout') ? ErrorCode.TIMEOUT : ErrorCode.NETWORK_ERROR,
            )
        }
    }

    /**
     * 使用Puppeteer获取动态HTML
     */
    private static async fetchWithPuppeteer(
        url: string,
        timeout: number,
        waitForSelector?: string,
        userAgent?: string,
    ): Promise<ToolResult<HtmlFetchResult>> {
        const startTime = Date.now()
        let page: Page | null = null

        try {
            // 初始化浏览器
            await this.initBrowser()

            if (!this.browser) {
                return createErrorResult(
                    'Puppeteer初始化',
                    '无法启动浏览器',
                    ErrorCode.UNKNOWN_ERROR,
                )
            }

            page = await this.browser.newPage()

            // 设置用户代理
            if (userAgent) {
                await page.setUserAgent(userAgent)
            }

            // 设置视窗大小
            await page.setViewport({ width: 1920, height: 1080 })

            // 设置超时时间
            page.setDefaultTimeout(timeout)
            page.setDefaultNavigationTimeout(timeout)

            // 监听控制台输出和错误
            page.on('console', (msg) => {
                if (msg.type() === 'error') {
                    logger.warn(`页面控制台错误: ${msg.text()}`)
                }
            })

            page.on('pageerror', (error) => {
                logger.warn(`页面JavaScript错误: ${error.message}`)
            })

            // 导航到页面
            const response = await page.goto(url, {
                waitUntil: 'networkidle0',
                timeout,
            })

            if (!response) {
                return createErrorResult(
                    '页面导航',
                    '无法导航到目标页面',
                    ErrorCode.NETWORK_ERROR,
                )
            }

            if (!response.ok()) {
                return createErrorResult(
                    '页面响应',
                    `HTTP错误: ${response.status()} ${response.statusText()}`,
                    response.status() === 403
                        ? ErrorCode.FORBIDDEN
                        : response.status() === 404
                            ? ErrorCode.NOT_FOUND
                            : response.status() >= 500 ? ErrorCode.SERVER_ERROR : ErrorCode.NETWORK_ERROR,
                )
            }

            // 等待特定选择器（如果指定）
            if (waitForSelector) {
                try {
                    await page.waitForSelector(waitForSelector, { timeout: Math.min(timeout, 10000) })
                    logger.info(`成功等待选择器: ${waitForSelector}`)
                }
                catch {
                    logger.warn(`等待选择器超时: ${waitForSelector}, 继续执行`)
                }
            }

            // 获取页面HTML
            const html = await page.content()
            const loadTime = Date.now() - startTime

            // 获取页面标题和基础信息
            const [title, description] = await Promise.all([
                page.title().catch(() => undefined),
                page.$eval('meta[name="description"]', el => el.getAttribute('content')).catch(() => undefined),
            ])

            const result: HtmlFetchResult = {
                html,
                contentType: 'text/html',
                statusCode: response.status(),
                finalUrl: response.url(),
                loadTime,
                isStatic: false,
                metadata: {
                    ...(title && { title }),
                    ...(description && { description }),
                    charset: 'UTF-8',
                    size: html.length,
                },
            }

            logger.info(`动态HTML获取成功: ${result.finalUrl}, 大小: ${result.metadata.size} 字符, 耗时: ${loadTime}ms`)

            return createSuccessResult(result, {
                url: result.finalUrl,
                contentLength: result.metadata.size,
            })
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)

            return createErrorResult(
                'Puppeteer获取',
                `获取动态HTML失败: ${errorMessage}`,
                errorMessage.includes('timeout') ? ErrorCode.TIMEOUT : ErrorCode.NETWORK_ERROR,
            )
        }
        finally {
            // 关闭页面
            if (page) {
                try {
                    await page.close()
                }
                catch (error) {
                    logger.warn(`关闭页面失败: ${error}`)
                }
            }
        }
    }

    /**
     * 初始化浏览器实例
     */
    private static async initBrowser(): Promise<void> {
        if (this.browser) {
            return
        }

        try {
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920,1080',
                ],
            })

            logger.info('Puppeteer浏览器已启动')

            // 监听浏览器断开连接
            this.browser.on('disconnected', () => {
                logger.info('Puppeteer浏览器已断开连接')
                this.browser = null
            })
        }
        catch (error) {
            logger.error('启动Puppeteer浏览器失败:', error)
            throw error
        }
    }

    /**
     * 关闭浏览器实例
     */
    static async closeBrowser(): Promise<void> {
        if (this.browser) {
            try {
                await this.browser.close()
                this.browser = null
                logger.info('Puppeteer浏览器已关闭')
            }
            catch (error) {
                logger.error('关闭Puppeteer浏览器失败:', error)
            }
        }
    }

    /**
     * 从HTML中提取基础元数据
     */
    private static extractBasicMetadata(html: string): { title?: string, description?: string, charset?: string } {
        const metadata: { title?: string, description?: string, charset?: string } = {}

        try {
            // 提取标题
            const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
            if (titleMatch?.[1]) {
                metadata.title = titleMatch[1].trim()
            }

            // 提取描述
            const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
            if (descMatch?.[1]) {
                metadata.description = descMatch[1].trim()
            }

            // 提取字符集
            const charsetMatch = html.match(/<meta[^>]*charset=["']?([^"'\s>]*)/i)
            if (charsetMatch?.[1]) {
                metadata.charset = charsetMatch[1].toUpperCase()
            }
        }
        catch (error) {
            logger.warn('提取HTML元数据失败:', error)
        }

        return metadata
    }
}
