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
