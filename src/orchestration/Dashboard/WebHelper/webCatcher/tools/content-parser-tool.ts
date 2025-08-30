import type { ContentParseResult, ContentParserInput, ToolResult } from '../types.js'
import { Readability } from '@mozilla/readability'
import * as cheerio from 'cheerio'
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
                description: '解析HTML内容提取主要文章内容，使用Readability算法和Cheerio结合，支持图片、链接和结构化数据提取',
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

            // 1. 首先使用Cheerio进行基础解析
            const cheerioResult = await this.parseWithCheerio(
                html,
                url,
                extractImages,
                extractLinks,
            )

            if (!cheerioResult.success) {
                return cheerioResult
            }

            const cheerioData = cheerioResult.data!

            // 2. 尝试使用Readability提取主要内容
            const readabilityResult = await this.extractWithReadability(html, url)
            let readabilityData: any = null

            if (readabilityResult.success) {
                readabilityData = readabilityResult.data!
            }
            else {
                logger.warn('Readability解析失败，将使用Cheerio回退方案')
            }

            // 3. 合并结果 - 优先使用Readability，但支持Cheerio回退
            let content = ''
            let textContent = ''

            if (readabilityData && readabilityData.content) {
                content = readabilityData.content
                textContent = readabilityData.textContent || ''
            }
            else {
                // 回退到Cheerio提取内容
                const $ = cheerio.load(html)
                // 移除脚本和样式标签
                $('script, style, nav, footer, .ad, .advertisement, .sidebar').remove()

                // 尝试提取主要内容区域
                const mainContent = $('main, article, .content, .post, .entry, .body').first()
                if (mainContent.length > 0) {
                    content = mainContent.html() || ''
                    textContent = mainContent.text().trim()
                }
                else {
                    // 如果没有找到主要内容区域，提取所有段落
                    const paragraphs = $('p, h1, h2, h3, h4, h5, h6').map((_, el) => $(el).text().trim()).get()
                    textContent = paragraphs.filter(p => p.length > 10).join('\n\n')
                    content = textContent
                }
            }

            const result: any = {
                title: (readabilityData?.title || cheerioData.title || '无标题').trim(),
                content,
                excerpt: readabilityData?.excerpt || this.generateExcerpt(textContent),
                // 使用条件属性避免undefined分配问题
                ...(readabilityData?.author && { author: readabilityData.author }),
                ...(readabilityData?.publishedTime && { publishedTime: readabilityData.publishedTime }),
                readingTime: this.calculateReadingTime(textContent),
                wordCount: this.countWords(textContent),
                images: extractImages ? cheerioData.images : [],
                links: extractLinks ? cheerioData.links : [],
                structuredData: cheerioData.structuredData,
            }

            // 4. 验证内容长度 - 降低阈值以支持更多类型的页面
            const actualMinLength = Math.min(minContentLength, 20) // 最低20字符
            if (result.content.length < actualMinLength && textContent.length < actualMinLength) {
                return createErrorResult(
                    '内容验证',
                    `提取的内容过短 (content: ${result.content.length}, text: ${textContent.length} < ${actualMinLength} 字符)`,
                    ErrorCode.CONTENT_TOO_SHORT,
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
     * 使用Cheerio进行辅助解析
     */
    private static async parseWithCheerio(
        html: string,
        url: string,
        extractImages: boolean,
        extractLinks: boolean,
    ): Promise<ToolResult<{
        title: string
        images: Array<{ src: string, alt?: string, caption?: string }>
        links: Array<{ href: string, text: string, isInternal: boolean }>
        structuredData?: any
    }>> {
        try {
            const $ = cheerio.load(html)

            // 提取标题
            const title = $('title').text().trim()
                || $('h1').first().text().trim()
                || $('meta[property="og:title"]').attr('content') || ''

            // 提取图片
            const images: Array<{ src: string, alt?: string, caption?: string }> = []
            if (extractImages) {
                $('img').each((_, element) => {
                    const $img = $(element)
                    let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src')

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

                        const alt = $img.attr('alt') || ''
                        const caption = $img.closest('figure').find('figcaption').text().trim()
                            || $img.parent().find('.caption, .image-caption').text().trim() || ''

                        images.push({
                            src,
                            ...(alt && { alt }),
                            ...(caption && { caption }),
                        })
                    }
                })
            }

            // 提取链接
            const links: Array<{ href: string, text: string, isInternal: boolean }> = []
            if (extractLinks) {
                $('a[href]').each((_, element) => {
                    const $link = $(element)
                    let href = $link.attr('href')

                    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                        const text = $link.text().trim()

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
            }

            // 提取结构化数据
            const structuredData = this.extractStructuredData($)

            const result = {
                title,
                images,
                links,
                structuredData,
            }

            return createSuccessResult(result)
        }
        catch (error) {
            return createErrorResult(
                'Cheerio解析',
                `解析失败: ${error instanceof Error ? error.message : String(error)}`,
                ErrorCode.PARSING_ERROR,
            )
        }
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
    private static extractStructuredData($: cheerio.CheerioAPI): any {
        const structuredData: any = {}

        try {
            // 提取JSON-LD
            $('script[type="application/ld+json"]').each((_, element) => {
                try {
                    const jsonData = JSON.parse($(element).html() || '{}')
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
            $('meta[property^="og:"]').each((_, element) => {
                const property = $(element).attr('property')
                const content = $(element).attr('content')
                if (property && content) {
                    ogData[property] = content
                }
            })
            if (Object.keys(ogData).length > 0) {
                structuredData.openGraph = ogData
            }

            // 提取Twitter Card数据
            const twitterData: Record<string, string> = {}
            $('meta[name^="twitter:"]').each((_, element) => {
                const name = $(element).attr('name')
                const content = $(element).attr('content')
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
