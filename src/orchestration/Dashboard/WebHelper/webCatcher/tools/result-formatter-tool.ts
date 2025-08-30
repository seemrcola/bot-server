import type {
    FormatResult,
    OutputFormat,
    ResultFormatterInput,
    ToolResult,
} from '../types.js'
import { HumanMessage } from '@langchain/core/messages'
import { createLLM } from '@/orchestration/llm.js'
import { createLogger } from '@/utils/logger.js'
import { ResultFormatterSchema } from '../types.js'
import {
    createSuccessResult,
    withErrorHandling,
} from '../utils/error-handler.js'

const logger = createLogger('ResultFormatterTool')

/**
 * 结果格式化工具类 - 基于LLM的智能格式化
 */
export class ResultFormatterTool {
    /**
     * 获取工具注册信息
     */
    static getToolDefinition() {
        return {
            name: 'resultFormatter',
            schema: {
                title: '智能结果格式化工具',
                description: '使用LLM智能分析和格式化网页内容，生成最适合的输出格式，支持Markdown、摘要、结构化展示等多种格式',
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
     * LLM驱动的智能格式化
     */
    static async formatResult(input: ResultFormatterInput): Promise<ToolResult<FormatResult>> {
        return withErrorHandling('智能格式化', async () => {
            const {
                content,
                format = 'markdown',
                maxLength,
                includeMetadata = true,
            } = input

            logger.info(`开始LLM智能格式化: 格式=${format}, 包含元数据=${includeMetadata}`)

            const startTime = Date.now()

            // 构建LLM提示词
            const prompt = this.buildFormattingPrompt(content, format, maxLength, includeMetadata)

            // 这里应该调用LLM API，但当前返回一个简化的格式化结果
            // TODO: 集成LLM API调用
            const formattedContent = await this.callLLMForFormatting(prompt, content, format)

            const formatTime = Date.now() - startTime

            const result: FormatResult = {
                format,
                content: formattedContent,
                metadata: {
                    originalLength: content.content.length,
                    formattedLength: formattedContent.length,
                    formatTime,
                },
            }

            logger.info(`LLM格式化完成: 格式=${format}, 原始长度=${result.metadata.originalLength}, 格式化后长度=${result.metadata.formattedLength}, 耗时=${formatTime}ms`)

            return createSuccessResult(result, {
                contentLength: result.metadata.formattedLength,
            })
        })()
    }

    /**
     * 构建LLM格式化提示词
     */
    private static buildFormattingPrompt(
        content: ResultFormatterInput['content'],
        format: OutputFormat,
        maxLength?: number,
        includeMetadata: boolean = true,
    ): string {
        // 针对不同格式的专业提示词
        const formatInstructions = {
            markdown: `请将网页内容转换为清晰、结构化的Markdown格式：
- 使用适当的标题层级 (# ## ###)
- 保持原有的段落结构和换行
- 对重要内容使用 **粗体** 或 *斜体* 强调
- 如果有列表，使用 - 或 1. 格式
- 保留原文的语义和逻辑结构
- 去除冗余的HTML标签和样式信息`,

            json: `请将网页内容结构化为标准JSON格式，包含以下字段：
{
  "title": "文章标题",
  "summary": "内容摘要（2-3句话）",
  "content": "主要内容（保持段落结构）",
  "key_points": ["要点1", "要点2", "要点3"],
  "metadata": {
    "word_count": "字数统计",
    "reading_time": "预估阅读时间",
    "content_type": "内容类型（如文章、新闻、教程等）"
  }
}
确保JSON格式正确，可以被解析`,

            summary: `请生成一份专业的内容摘要：
- 用2-3个段落总结核心内容
- 突出关键信息和重要观点
- 保持客观中性的语调
- 如果有数据或事实，请重点提及
- 摘要应该让读者快速了解原文的主要内容`,

            text: `请将内容格式化为易读的纯文本格式：
- 使用适当的段落分隔
- 保持清晰的逻辑层次
- 去除HTML标签和格式符号
- 使用简洁明了的语言
- 保持原文的信息完整性`,
        }

        let prompt = `你是一个专业的内容格式化专家。请按照以下要求处理网页内容：\n\n`

        // 格式化要求
        prompt += `## 格式化要求\n${formatInstructions[format]}\n\n`

        // 长度限制
        if (maxLength) {
            prompt += `## 长度限制\n请将输出内容控制在${maxLength}字符以内，如需精简请保留最重要的信息。\n\n`
        }

        // 元数据处理
        if (includeMetadata) {
            prompt += `## 元数据处理\n请适当保留和利用标题、摘要等元数据信息，增强内容的可读性。\n\n`
        }

        // 内容信息
        prompt += `## 待处理内容\n\n`
        prompt += `**标题**: ${content.title}\n\n`

        if (content.excerpt) {
            prompt += `**摘要**: ${content.excerpt}\n\n`
        }

        prompt += `**正文内容**:\n${content.content}\n\n`

        // 输出要求
        prompt += `## 输出要求\n直接输出格式化后的内容，不要包含任何解释或说明文字。确保输出结果符合${format}格式的标准要求。`

        return prompt
    }

    /**
     * 调用LLM进行智能格式化
     */
    private static async callLLMForFormatting(
        prompt: string,
        content: ResultFormatterInput['content'],
        format: OutputFormat,
    ): Promise<string> {
        try {
            // 创建LLM实例
            const llm = createLLM()

            // 构建消息
            const message = new HumanMessage(prompt)

            // 调用LLM进行格式化
            const response = await llm.invoke([message])

            // 返回LLM的回复内容
            const formattedContent = response.content.toString().trim()

            logger.info(`LLM格式化完成: 格式=${format}, 输入长度=${content.content.length}, 输出长度=${formattedContent.length}`)

            return formattedContent
        }
        catch (error: any) {
            logger.error('LLM格式化失败，使用备用格式化', { error: error?.message || error, format })
            return this.fallbackFormatting(content, format)
        }
    }

    /**
     * 备用格式化方法（当LLM调用失败时使用）
     */
    private static fallbackFormatting(
        content: ResultFormatterInput['content'],
        format: OutputFormat,
    ): string {
        switch (format) {
            case 'markdown': {
                return `# ${content.title}\n\n${content.excerpt ? `**摘要**: ${content.excerpt}\n\n` : ''}${content.content}`
            }

            case 'json': {
                return JSON.stringify({
                    title: content.title,
                    excerpt: content.excerpt,
                    content: content.content,
                    formatted_at: new Date().toISOString(),
                }, null, 2)
            }

            case 'summary': {
                const textContent = content.content.replace(/<[^>]*>/g, '').trim()
                const summary = textContent.length > 300
                    ? `${textContent.substring(0, 300)}...`
                    : textContent
                return `**${content.title}**\n\n${content.excerpt}\n\n${summary}`
            }

            case 'text': {
                const plainText = content.content.replace(/<[^>]*>/g, '').trim()
                return `${content.title}\n${'='.repeat(content.title.length)}\n\n${content.excerpt}\n\n${plainText}`
            }
            default:
                throw new Error(`不支持的格式: ${format}`)
        }
    }
}
