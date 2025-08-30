import type {
    FormatResult,
    OutputFormat,
    ResultFormatterInput,
    ToolResult,
} from '../types.js'
import TurndownService from 'turndown'
import { createLogger } from '@/utils/logger.js'
import { ResultFormatterSchema } from '../types.js'
import {
    createSuccessResult,
    withErrorHandling,
} from '../utils/error-handler.js'

const logger = createLogger('ResultFormatterTool')

/**
 * 结果格式化工具类 - 基于规则的确定性格式化
 */
export class ResultFormatterTool {
    /**
     * 获取工具注册信息
     */
    static getToolDefinition() {
        return {
            name: 'resultFormatter',
            schema: {
                title: '结果格式化工具',
                description: '将网页内容格式化为指定格式，支持Markdown、JSON、摘要、纯文本等多种输出格式，基于规则算法实现确定性转换',
                inputSchema: ResultFormatterSchema.shape,
            },
            handler: this.handleToolCall.bind(this),
        }
    }

    /**
     * 工具调用处理器
     */
    static async handleToolCall(params: any) {
        const logger = createLogger('ResultFormatterTool')
        logger.info('调用智能结果格式化工具', { format: params.format })
        const result = await this.formatResult(params)

        if (result.success) {
            const data = result.data!
            return {
                content: [{
                    type: 'text',
                    text: data.content, // 直接返回LLM格式化的内容
                }],
                structuredContent: data as any,
            }
        }
        else {
            return {
                content: [{
                    type: 'text',
                    text: `格式化失败：${result.error!.message}`,
                }],
                error: result.error,
            }
        }
    }

    /**
     * 基于规则的格式化（不依赖LLM）
     */
    static async formatResult(input: ResultFormatterInput): Promise<ToolResult<FormatResult>> {
        return withErrorHandling('格式化处理', async () => {
            const {
                content,
                format = 'markdown',
                maxLength,
                includeMetadata = true,
            } = input

            logger.info(`开始格式化处理: 格式=${format}, 包含元数据=${includeMetadata}`)

            const startTime = Date.now()

            let formattedContent: string

            switch (format) {
                case 'markdown':
                    formattedContent = this.formatToMarkdown(content, maxLength, includeMetadata)
                    break
                case 'json':
                    formattedContent = this.formatToJson(content, maxLength, includeMetadata)
                    break
                case 'summary':
                    formattedContent = this.formatToSummary(content, maxLength)
                    break
                case 'text':
                default:
                    formattedContent = this.formatToText(content, maxLength)
                    break
            }

            const formatTime = Date.now() - startTime

            const result: FormatResult = {
                format,
                content: formattedContent,
                metadata: {
                    originalLength: content.content?.length || 0,
                    formattedLength: formattedContent.length,
                    processingTime: formatTime,
                    wordCount: this.countWords(formattedContent),
                    includeMetadata,
                },
            }

            logger.info(`格式化完成: ${format}格式, 原长度=${result.metadata.originalLength}, 格式化后=${result.metadata.formattedLength}, 耗时=${formatTime}ms`)

            return createSuccessResult(result, {
                contentLength: formattedContent.length,
            })
        })()
    }

    /**
     * 格式化为Markdown
     */
    private static formatToMarkdown(
        content: ResultFormatterInput['content'],
        maxLength?: number,
        includeMetadata: boolean = true,
    ): string {
        let markdown = ''

        // 标题处理
        if (content.title) {
            markdown += `# ${content.title}\n\n`
        }

        // 摘要处理
        if (content.excerpt && includeMetadata) {
            markdown += `## 摘要\n\n${content.excerpt}\n\n`
        }

        // 内容处理
        if (content.content) {
            let mainContent = content.content

            // 长度限制
            if (maxLength && mainContent.length > maxLength) {
                mainContent = `${mainContent.substring(0, maxLength)}...`
            }

            // HTML到Markdown转换
            mainContent = this.htmlToMarkdown(mainContent)
            markdown += `## 正文\n\n${mainContent}\n\n`
        }

        return markdown.trim()
    }

    /**
     * 格式化为JSON
     */
    private static formatToJson(
        content: ResultFormatterInput['content'],
        maxLength?: number,
        includeMetadata: boolean = true,
    ): string {
        const jsonObj: any = {
            title: content.title,
            summary: content.excerpt,
        }

        let mainContent = content.content || ''
        if (maxLength && mainContent.length > maxLength) {
            mainContent = `${mainContent.substring(0, maxLength)}...`
        }

        // 清理HTML标签
        mainContent = mainContent.replace(/<[^>]+>/g, '').trim()
        jsonObj.content = mainContent

        if (includeMetadata) {
            jsonObj.metadata = {
                wordCount: this.countWords(mainContent),
                contentLength: mainContent.length,
                processedAt: new Date().toISOString(),
            }
        }

        return JSON.stringify(jsonObj, null, 2)
    }

    /**
     * 格式化为摘要
     */
    private static formatToSummary(
        content: ResultFormatterInput['content'],
        maxLength?: number,
    ): string {
        let summary = ''

        if (content.title) {
            summary += `**${content.title}**\n\n`
        }

        if (content.excerpt) {
            summary += `${content.excerpt}\n\n`
        }

        if (content.content) {
            // 提取纯文本
            const textContent = content.content.replace(/<[^>]*>/g, '').trim()

            // 生成智能摘要（取前几段）
            const paragraphs = textContent.split('\n').filter(p => p.trim().length > 20)
            const summaryText = paragraphs.slice(0, 3).join('\n\n')

            if (maxLength && summaryText.length > maxLength) {
                summary += `${summaryText.substring(0, maxLength)}...`
            }
            else {
                summary += summaryText
            }
        }

        return summary.trim()
    }

    /**
     * 格式化为纯文本
     */
    private static formatToText(
        content: ResultFormatterInput['content'],
        maxLength?: number,
    ): string {
        let text = ''

        if (content.title) {
            text += `${content.title}\n${'='.repeat(content.title.length)}\n\n`
        }

        if (content.excerpt) {
            text += `摘要: ${content.excerpt}\n\n`
        }

        if (content.content) {
            // 清理HTML并格式化
            let plainText = content.content.replace(/<[^>]*>/g, '').trim()
            plainText = plainText.replace(/\n\s*\n\s*\n/g, '\n\n') // 清理多余换行

            if (maxLength && plainText.length > maxLength) {
                plainText = `${plainText.substring(0, maxLength)}...`
            }

            text += plainText
        }

        return text.trim()
    }

    /**
     * HTML到Markdown转换 - 使用专业的Turndown库
     */
    private static htmlToMarkdown(html: string): string {
        const turndownService = new TurndownService({
            headingStyle: 'atx',
            bulletListMarker: '-',
            codeBlockStyle: 'fenced',
            fence: '```',
            emDelimiter: '*',
            strongDelimiter: '**',
            linkStyle: 'inlined',
            linkReferenceStyle: 'full',
        })

        return turndownService.turndown(html)
    }

    /**
     * 统计词数
     */
    private static countWords(text: string): number {
        // 简单的词数统计（中文按字符，英文按单词）
        const chineseChars = (text.match(/[\u4E00-\u9FFF]/g) || []).length
        const englishWords = (text.match(/\b[a-z]+\b/gi) || []).length
        return chineseChars + englishWords
    }
}

// 创建单例实例
const resultFormatterTool = new ResultFormatterTool()

export default resultFormatterTool
