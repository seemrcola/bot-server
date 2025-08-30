import type { ContentParseResult, ContentParserInput, ToolResult } from '../types.js'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { createLogger } from '@/utils/logger.js'
import { ContentParserSchema } from '../types.js'
import {
    createErrorResult,
    createSuccessResult,
    ErrorCode,
    withErrorHandling,
} from '../utils/error-handler.js'

const logger = createLogger('ContentParserTool')

/**
 * 内容解析工具类
 */
export class ContentParserTool {
    /**
     * 获取工具注册信息
     */
    static getToolDefinition() {
        return {
            name: 'contentParser',
            schema: {
                title: '网页内容解析工具',
                description: '解析HTML内容提取主要文章内容，使用Readability算法提取结构化内容，支持图片、链接和结构化数据提取',
                inputSchema: ContentParserSchema.shape,
            },
            handler: this.handleToolCall.bind(this),
        }
    }

    /**
     * 工具调用处理器
     */
    static async handleToolCall(params: any) {
        const logger = createLogger('ContentParserTool')
        logger.info('调用内容解析工具', { url: params.url })
        const result = await this.parseContent(params)

        if (result.success) {
            const data = result.data!
            return {
                content: [{
                    type: 'text',
                    text: `内容解析成功：标题: ${data.title}，字数: ${data.wordCount}，阅读时间: ${data.readingTime}分钟`,
                }],
                structuredContent: data as any,
            }
        }
        else {
            return {
                content: [{
                    type: 'text',
                    text: `内容解析失败：${result.error!.message}`,
                }],
                error: result.error,
            }
        }
    }

    /**
     * 解析网页内容
     */
    static async parseContent(input: ContentParserInput): Promise<ToolResult<ContentParseResult>> {
        return withErrorHandling('内容解析', async () => {
            const {
                html,
                url,
                extractImages = true,
                extractLinks = true,
                minContentLength = 100,
            } = input

            logger.info(`开始解析内容: ${url}`)

            // 1. 使用Readability提取主要内容
            const readabilityResult = await this.extractWithReadability(html, url)

            if (!readabilityResult.success) {
                return readabilityResult
            }

            const readabilityData = readabilityResult.data!

            // 2. 从 DOM 中提取图片和链接（如果需要）
            const dom = new JSDOM(html, { url })
            const document = dom.window.document

            const images = extractImages ? this.extractImages(document, url) : []
            const links = extractLinks ? this.extractLinks(document, url) : []
            const structuredData = this.extractStructuredData(document)

            const result: ContentParseResult = {
                title: readabilityData.title || '无标题',
                content: readabilityData.content, // 返回HTML内容，由Formatter负责转换
                excerpt: readabilityData.excerpt || this.generateExcerpt(readabilityData.textContent),
                ...(readabilityData.author && { author: readabilityData.author }),
                ...(readabilityData.publishedTime && { publishedTime: readabilityData.publishedTime }),
                readingTime: this.calculateReadingTime(readabilityData.textContent),
                wordCount: this.countWords(readabilityData.textContent),
                images,
                links,
                structuredData,
            }

            // 3. 验证内容长度
            const actualMinLength = Math.min(minContentLength, 20)
            if (result.content.length < actualMinLength) {
                return createErrorResult(
                    '内容验证',
                    `提取的内容过短 (${result.content.length} < ${actualMinLength} 字符)`,
                    ErrorCode.PARSING_ERROR,
                )
            }

            logger.info(`内容解析成功: 标题="${result.title}", 内容长度=${result.content.length}, 字数=${result.wordCount}`)

            return createSuccessResult(result, {
                url,
                contentLength: result.content.length,
            })
        })()
    }

    /**
     * 使用Readability提取主要内容
     */
    private static async extractWithReadability(
        html: string,
        url: string,
    ): Promise<ToolResult<{
        title: string
        content: string
        textContent: string
        excerpt: string
        author?: string
        publishedTime?: string
    }>> {
        try {
            // 创建DOM
            const dom = new JSDOM(html, { url })
            const document = dom.window.document

            // 使用Readability解析
            const reader = new Readability(document, {
                debug: false,
                maxElemsToParse: 0, // 不限制解析元素数量
                nbTopCandidates: 5,
                charThreshold: 500,
                classesToPreserve: ['highlight', 'code', 'pre'],
            })

            const article = reader.parse()

            if (!article) {
                logger.warn('Readability无法解析文章内容，页面结构可能不符合标准')
                return createErrorResult(
                    'Readability解析',
                    '无法提取文章内容，可能页面结构不符合标准',
                    ErrorCode.PARSING_ERROR,
                )
            }

            const result: any = {
                title: article.title || '',
                content: article.content || '',
                textContent: article.textContent || '',
                excerpt: article.excerpt || '',
                ...(article.byline && { author: article.byline }),
                ...(this.extractPublishedTime(html) && { publishedTime: this.extractPublishedTime(html) }),
            }

            return createSuccessResult(result)
        }
        catch (error) {
            return createErrorResult(
                'Readability解析',
                `解析失败: ${error instanceof Error ? error.message : String(error)}`,
                ErrorCode.PARSING_ERROR,
            )
        }
    }

    /**
     * 从DOM中提取图片信息
     */
    private static extractImages(document: Document, url: string): Array<{ src: string, alt?: string, caption?: string }> {
        const images: Array<{ src: string, alt?: string, caption?: string }> = []
        const imgElements = document.querySelectorAll('img')

        imgElements.forEach((img) => {
            let src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src')

            if (src) {
                // 处理相对URL
                if (src.startsWith('/')) {
                    const urlObj = new URL(url)
                    src = `${urlObj.protocol}//${urlObj.host}${src}`
                }
                else if (src.startsWith('./') || !src.startsWith('http')) {
                    try {
                        src = new URL(src, url).href
                    }
                    catch {
                        // 忽略无效URL
                        return
                    }
                }

                const alt = img.getAttribute('alt') || undefined
                const figureElement = img.closest('figure')
                const caption = figureElement?.querySelector('figcaption')?.textContent?.trim() || undefined

                images.push({
                    src,
                    ...(alt && { alt }),
                    ...(caption && { caption }),
                })
            }
        })

        return images
    }

    /**
     * 从DOM中提取链接信息
     */
    private static extractLinks(document: Document, url: string): Array<{ href: string, text: string, isInternal: boolean }> {
        const links: Array<{ href: string, text: string, isInternal: boolean }> = []
        const linkElements = document.querySelectorAll('a[href]')

        linkElements.forEach((link) => {
            let href = link.getAttribute('href')

            if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                const text = link.textContent?.trim()

                if (text) {
                    // 处理相对URL
                    if (href.startsWith('/')) {
                        const urlObj = new URL(url)
                        href = `${urlObj.protocol}//${urlObj.host}${href}`
                    }
                    else if (!href.startsWith('http')) {
                        try {
                            href = new URL(href, url).href
                        }
                        catch {
                            // 忽略无效URL
                            return
                        }
                    }

                    const isInternal = new URL(href).hostname === new URL(url).hostname

                    links.push({
                        href,
                        text,
                        isInternal,
                    })
                }
            }
        })

        return links
    }

    /**
     * 提取发布时间
     */
    private static extractPublishedTime(html: string): string | undefined {
        const patterns = [
            /<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
            /<meta[^>]*name=["']publish.*date["'][^>]*content=["']([^"']+)["']/i,
            /<time[^>]*datetime=["']([^"']+)["']/i,
            /<meta[^>]*name=["']date["'][^>]*content=["']([^"']+)["']/i,
        ]

        for (const pattern of patterns) {
            const match = html.match(pattern)
            if (match) {
                return match[1]
            }
        }

        return undefined
    }

    /**
     * 提取结构化数据
     */
    private static extractStructuredData(document: Document): any {
        const structuredData: any = {}

        try {
            // 提取JSON-LD
            const jsonLdElements = document.querySelectorAll('script[type="application/ld+json"]')
            jsonLdElements.forEach((element) => {
                try {
                    const jsonData = JSON.parse(element.textContent || '{}')
                    if (jsonData['@type']) {
                        structuredData.jsonLd = jsonData
                    }
                }
                catch {
                    // 忽略JSON解析错误
                }
            })

            // 提取Open Graph数据
            const ogData: Record<string, string> = {}
            const ogElements = document.querySelectorAll('meta[property^="og:"]')
            ogElements.forEach((element) => {
                const property = element.getAttribute('property')
                const content = element.getAttribute('content')
                if (property && content) {
                    ogData[property] = content
                }
            })
            if (Object.keys(ogData).length > 0) {
                structuredData.openGraph = ogData
            }

            // 提取Twitter Card数据
            const twitterData: Record<string, string> = {}
            const twitterElements = document.querySelectorAll('meta[name^="twitter:"]')
            twitterElements.forEach((element) => {
                const name = element.getAttribute('name')
                const content = element.getAttribute('content')
                if (name && content) {
                    twitterData[name] = content
                }
            })
            if (Object.keys(twitterData).length > 0) {
                structuredData.twitter = twitterData
            }
        }
        catch (error) {
            logger.warn('提取结构化数据失败:', error)
        }

        return Object.keys(structuredData).length > 0 ? structuredData : undefined
    }

    /**
     * 生成内容摘要
     */
    private static generateExcerpt(content: string, maxLength = 200): string {
        // 移除HTML标签
        const text = content.replace(/<[^>]*>/g, '').trim()

        if (text.length <= maxLength) {
            return text
        }

        // 找到最后一个完整句子
        const truncated = text.substring(0, maxLength)
        const lastSentence = truncated.lastIndexOf('.')
        const lastQuestion = truncated.lastIndexOf('?')
        const lastExclamation = truncated.lastIndexOf('!')

        const lastPunctuation = Math.max(lastSentence, lastQuestion, lastExclamation)

        if (lastPunctuation > maxLength * 0.7) {
            return truncated.substring(0, lastPunctuation + 1)
        }

        // 找到最后一个空格
        const lastSpace = truncated.lastIndexOf(' ')
        if (lastSpace > maxLength * 0.7) {
            return `${truncated.substring(0, lastSpace)}...`
        }

        return `${truncated}...`
    }

    /**
     * 计算阅读时间（分钟）
     */
    private static calculateReadingTime(text: string): number {
        const wordsPerMinute = 200 // 中文约200字/分钟
        const wordCount = this.countWords(text)
        return Math.max(1, Math.round(wordCount / wordsPerMinute))
    }

    /**
     * 统计字数
     */
    private static countWords(text: string): number {
        // 移除HTML标签和多余空格
        const cleanText = text.replace(/<[^>]*>/g, '').trim()

        // 统计中文字符和英文单词
        const chineseChars = (cleanText.match(/[\u4E00-\u9FA5]/g) || []).length
        const englishWords = (cleanText.match(/[a-z]+/gi) || []).length

        return chineseChars + englishWords
    }
}
