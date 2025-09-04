export function extractText(content: unknown): string {
    if (typeof content === 'string')
        return content
    if (Array.isArray(content)) {
        return content
            .map(part => String((part as any)?.text ?? ''))
            .join('')
    }
    if (content && typeof content === 'object' && (content as any).type === 'text') {
        return String((content as any).text ?? '')
    }
    return String(content ?? '')
}

/**
 * 从LLM输出文本中提取JSON对象
 * 处理LLM可能输出的额外文本，只提取JSON部分进行解析
 * @param text - LLM输出的原始文本
 * @returns 解析结果：成功返回{success: true, data: object}，失败返回{success: false, error: string}
 */
export function extractJsonFromText(text: string): { success: true, data: any } | { success: false, error: string } {
    try {
        // 查找第一个 { 和最后一个 } 的位置
        const start = text.indexOf('{')
        const end = text.lastIndexOf('}')

        // 如果找不到有效的JSON边界，直接尝试解析原文本
        const jsonText = start >= 0 && end >= start ? text.slice(start, end + 1) : text

        const parsed = JSON.parse(jsonText)
        return { success: true, data: parsed }
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

export function extractDisplayableTextFromToolResult(toolResult: any): string {
    const resultContent: unknown = toolResult?.content
    if (Array.isArray(resultContent)) {
        const texts: string[] = []
        for (const part of resultContent) {
            if (
                part
                && typeof part === 'object'
                && (part as any).type === 'text'
                && typeof (part as any).text === 'string'
            ) {
                texts.push((part as any).text)
            }
        }
        return texts.length > 0 ? texts.join('') : '工具未返回可显示的文本结果。'
    }
    else if (typeof resultContent === 'string') {
        return resultContent
    }
    return '工具未返回可显示的文本结果。'
}
