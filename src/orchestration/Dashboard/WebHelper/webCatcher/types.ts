import { z } from 'zod'

/**
 * 工具执行结果的通用接口
 */
export interface ToolResult<T = any> {
    success: boolean
    data?: T
    error?: {
        step: string
        message: string
        code?: string
    }
    metadata?: {
        processingTime: number
        contentLength?: number
        url?: string
        timestamp: string
    }
}

/**
 * URL验证结果
 */
export interface UrlValidationResult {
    isValid: boolean
    normalizedUrl: string
    protocol: string
    domain: string
    isSecure: boolean
}

/**
 * HTML获取结果
 */
export interface HtmlFetchResult {
    html: string
    contentType: string
    statusCode: number
    finalUrl: string
    loadTime: number
    isStatic: boolean
    metadata: {
        title?: string | undefined
        description?: string | undefined
        charset?: string | undefined
        size: number
    }
}

/**
 * 内容解析结果
 */
export interface ContentParseResult {
    title: string
    content: string
    excerpt: string
    author?: string | undefined
    publishedTime?: string | undefined
    readingTime?: number
    wordCount: number
    images: Array<{
        src: string
        alt?: string
        caption?: string
    }>
    links: Array<{
        href: string
        text: string
        isInternal: boolean
    }>
    structuredData?: any
}

/**
 * 格式化输出类型
 */
export type OutputFormat = 'markdown' | 'json' | 'summary' | 'text'

/**
 * 结果格式化结果
 */
export interface FormatResult {
    format: OutputFormat
    content: string
    metadata: {
        originalLength: number
        formattedLength: number
        formatTime: number
    }
}

/**
 * Zod 验证模式
 */
export const UrlValidatorSchema = z.object({
    url: z.string().url('请提供有效的URL地址'),
    allowRedirects: z.boolean().optional().default(true),
    timeout: z.number().min(1000).max(60000).optional().default(30000),
})

export const HtmlFetcherSchema = z.object({
    url: z.string().url('请提供有效的URL地址'),
    useHeadless: z.boolean().optional().default(false),
    timeout: z.number().min(1000).max(60000).optional().default(30000),
    waitForSelector: z.string().optional(),
    userAgent: z.string().optional(),
})

export const ContentParserSchema = z.object({
    html: z.string().min(1, 'HTML内容不能为空'),
    url: z.string().url('请提供有效的URL地址'),
    extractImages: z.boolean().optional().default(true),
    extractLinks: z.boolean().optional().default(true),
    minContentLength: z.number().min(0).optional().default(100),
})

export const ResultFormatterSchema = z.object({
    content: z.object({
        title: z.string(),
        content: z.string(),
        excerpt: z.string(),
    }),
    format: z.enum(['markdown', 'json', 'summary', 'text']).default('markdown'),
    maxLength: z.number().min(100).optional(),
    includeMetadata: z.boolean().optional().default(true),
})

export type UrlValidatorInput = z.infer<typeof UrlValidatorSchema>
export type HtmlFetcherInput = z.infer<typeof HtmlFetcherSchema>
export type ContentParserInput = z.infer<typeof ContentParserSchema>
export type ResultFormatterInput = z.infer<typeof ResultFormatterSchema>
