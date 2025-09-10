/**
 * Agent 简明教程
 * 这里会写一下我实现这个案例项目的思路，以及一些知识点的补充。如果后续我学到了新的/正确的知识，我会更新这个文档。
 */

import type { BaseLanguageModel } from '@langchain/core/language_models/base'
import fs from 'node:fs'
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ChatDeepSeek } from '@langchain/deepseek'

/**
 * Tool 接口
 * @param name - 工具名称
 * @param description - 工具描述
 * @param func - 工具函数
 */
interface Tool {
    name: string
    description: string
    func: (...args: any[]) => any
}

/**
 * BaseMessage 接口
 * @param role - 角色
 * @param content - 内容
 */
type Role = 'ai' | 'human'
interface BaseMessage {
    role: Role
    content: string
}

/**
 * 创建大模型实例
 * @description 这里我们使用deepseek举例子
 */
const llm = new ChatDeepSeek({
    apiKey: 'sk-d945b0a4bf5f412abcc206a744b237c3', // 你的api key
    model: 'deepseek-chat', // 可选 'deepseek-chat' 或 'deepseek-reasoner'
    temperature: 0.5, // 温度
    streaming: true, // 流式输出
})

/**
 * 创建工具
 * @description 这里我们以读取文件为例
 */
const readFileTool: Tool = {
    name: 'read_file',
    description: '读取文件',
    func: async (filePath: string) => {
        return fs.readFileSync(filePath, 'utf-8')
    },
}
const helloWorldTool: Tool = {
    name: 'hello_world',
    description: '当用户问你hello world时，你回复hello world',
    func: async () => {
        return 'hello world'
    },
}
const tools: Tool[] = [readFileTool, helloWorldTool]

/**
 * Agent 类
 * @param llm - LLM 实例
 * @param tools - 工具列表
 * @param prompt - 系统提示词
 */
class Agent {
    private llm: BaseLanguageModel
    private tools: Tool[]
    private prompt: string

    constructor(llm: any, tools: Tool[], prompt: string) {
        this.llm = llm
        this.tools = tools
        this.prompt = prompt
    }

    private async intentAnalysis(messages: BaseMessage[]): Promise<{ intent: 'llm_call' } | { intent: 'tool_call', name: string, arguments: any }> {
        const lastMessage = messages[messages.length - 1]!

        const systemPrompt = `
你是一个智能的AI助手，你的任务是分析用户的请求，并决定如何响应。

你有以下几种选择：
1. **直接回答**: 如果这是一个普通问题或闲聊，你可以直接回答。
2. **使用工具**: 如果用户的请求需要执行特定操作（如读取文件），你可以使用工具。

可用的工具有:
${JSON.stringify(this.tools.map(t => ({ name: t.name, description: t.description })), null, 2)}

请根据用户的最新消息分析意图: "${lastMessage.content}"

你的响应必须是以下两种格式之一:

A) 如果是普通问题，请仅响应:
{ "intent": "llm_call" }

B) 如果需要使用工具，请响应一个包含工具信息的JSON对象:
{ "intent": "tool_call", "name": "工具名称", "arguments": { "参数名": "参数值" } }
`.trim()

        const response = await this.llm.invoke([new SystemMessage(systemPrompt)])
        const resultText = response.content.toString().trim()

        try {
            const start = resultText.indexOf('{')
            const end = resultText.lastIndexOf('}')
            const jsonStr = resultText.slice(start, end + 1)
            const result = JSON.parse(jsonStr)

            if (result.intent === 'tool_call' && result.name && this.tools.some(t => t.name === result.name))
                return { intent: 'tool_call', name: result.name, arguments: result.arguments || {} }
        }
        catch (e) {
            console.error('意图分析JSON解析失败:', resultText, e)
        }

        // 如果解析失败或格式不正确，则默认为 llm_call
        return { intent: 'llm_call' }
    }

    private async toolCall(messages: BaseMessage[], toolInfo: { name: string, arguments: any }) {
        // 1. 执行工具
        const tool = this.tools.find(t => t.name === toolInfo.name)
        if (!tool)
            return `错误：找不到名为 "${toolInfo.name}" 的工具。`

        let toolResult
        try {
            toolResult = await tool.func(...Object.values(toolInfo.arguments || {}))
        }
        catch (error: any) {
            toolResult = `工具执行出错: ${error.message}`
        }

        // 2. 生成最终回复
        const finalMessages = [
            ...messages.map(m => m.role === 'human' ? new HumanMessage(m.content) : new AIMessage(m.content)),
            new AIMessage(`好的，我将使用工具: ${toolInfo.name}`),
            new HumanMessage(`[${tool.name} 工具的结果]:\n${String(toolResult)}`),
        ]

        const finalResponse = await this.llm.invoke([
            new SystemMessage(this.prompt),
            ...finalMessages,
        ])

        return finalResponse
    }

    public async chat(messages: BaseMessage[]) {
        const analysisResult = await this.intentAnalysis(messages)

        if (analysisResult.intent === 'tool_call') {
            console.log(`--- 意图: 工具调用 (${analysisResult.name}) ---`)
            return this.toolCall(messages, { name: analysisResult.name, arguments: analysisResult.arguments })
        }
        else {
            console.log('--- 意图: 普通对话 ---')
            const chatMessages = messages.map((message) => {
                if (message.role === 'human')
                    return new HumanMessage(message.content)

                return new AIMessage(message.content)
            })
            const response = await this.llm.invoke([
                new SystemMessage(this.prompt),
                ...chatMessages,
            ])
            return response
        }
    }
}

/** ********************************************test */
const agent = new Agent(llm, tools, '你是一个乐于助人的AI助手')
async function test() {
    console.log('--- Testing LLM Call ---')
    const response1 = await agent.chat([{ role: 'human', content: '你好' }])
    console.log(response1.content)

    console.log('\n--- Testing Tool Call ---')
    const response2 = await agent.chat([{ role: 'human', content: '请帮我读一下 bot-server/package.json 文件' }])
    console.log(response2.content)
}
test()
/** ********************************************test */
