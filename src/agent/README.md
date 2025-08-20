# Agent 模块

本目录提供可独立迁移/打包的智能体模块，实现了基于链式处理的Agent架构。

## 🏗️ 架构概览

```
Agent Module/
├── agent.ts              # 核心Agent类：依赖提供者
├── chain/                # 链式处理模块（新增）
│   ├── agent-chain.ts    # 主链式处理器
│   ├── types.ts          # 类型定义
│   └── steps/            # 处理步骤
│       ├── intent-analysis.ts      # 意图分析
│       ├── direct-llm.ts           # 直接LLM回答
│       ├── react-execution.ts      # ReAct执行
│       └── response-enhancement.ts # 响应增强
├── executors/            # 执行器（底层实现）
│   ├── promptBaseToolUse.ReAct.ts  # Prompt模式ReAct
│   └── utils.ts          # 执行器工具函数
└── mcp/                  # MCP协议支持
    ├── client/           # MCP客户端
    └── server/           # MCP服务端
```

> 说明：为保持 `agent` 模块的单一职责与可复用性，已移除内部的 Agent 管理器。多智能体（A2A）管理请见 `src/A2A/manager.ts`。

## 🚀 核心特性

- **链式处理架构**：意图分析 → 执行 → 增强回复
- **智能意图识别**：自动判断是否需要工具调用
- **执行策略**：统一 Prompt 模式（已移除 Function 模式）
- **流式输出**：完整的异步流式处理
- **MCP工具集成**：自动发现和调用外部工具
- **响应增强**：对ReAct结果进行优化和格式化

## 📦 安装依赖

```bash
pnpm add @langchain/core @langchain/deepseek @modelcontextprotocol/sdk
```

## 🎯 快速开始

### 基础使用
当前Agent需要结合langchain使用，使用时需要先创建langchain的llm实例，然后传入Agent中。数据格式也尽量使用langchain的各种Message类型。

```typescript
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ChatDeepSeek } from '@langchain/deepseek'
import { Agent, AgentChain } from './index.js'

// 1. 创建LLM实例
const llm = new ChatDeepSeek({
    apiKey: process.env.LLM_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'deepseek-chat',
    temperature: 0.7,
    streaming: true,
})

// 2. 创建Agent
const agent = new Agent(llm, [], '你是一个乐于助人的AI助手。')
await agent.ready

// 3. 创建AgentChain并执行
const chain = new AgentChain(agent)
const messages = [new HumanMessage('你好，请介绍一下自己')]

for await (const chunk of chain.runChain(messages)) {
    process.stdout.write(chunk)
}
```

### 带工具的使用

```typescript
import type { ExternalServerConfig } from './mcp/client/manager.js'
import { Agent, AgentChain } from './index.js'

// 配置外部MCP服务
const servers: ExternalServerConfig[] = [
    { name: 'weather-server', version: '1.0.0', url: 'http://localhost:3101/mcp' },
    { name: 'system-server', version: '1.0.0', url: 'http://localhost:3102/mcp' },
]

// 创建Agent
const agent = new Agent(llm, servers, systemPrompt)
await agent.ready

// 执行链式处理
const chain = new AgentChain(agent)
const messages = [new HumanMessage('获取当前天气和系统信息')]

// 仅保留 Prompt 策略
const stream = await chain.runChain(messages, {
    maxSteps: 8,
    reactVerbose: false,
})

for await (const chunk of stream) {
    process.stdout.write(chunk)
}
```

## 🔧 API 文档

### Agent 类

```typescript
class Agent {
    constructor(
        llm: BaseLanguageModel,
        externalServers: ExternalServerConfig[] = [],
        systemPrompt: string
    )
}
```

**属性：**
- `ready: Promise<void>` - 初始化完成Promise
- `languageModel: BaseLanguageModel` - LLM实例
- `clientManager: ClientManager` - MCP客户端管理器
- `systemPromptValue: string` - 系统提示词

**方法：**
- `listTools(): Promise<ExternalTool[]>` - 获取可用工具列表

### AgentChain 类

```typescript
class AgentChain {
    constructor(agent: Agent)

    runChain(
        messages: BaseMessage[],
        options?: ChainOptions
    ): AsyncIterable<string>
}
```

**ChainOptions 接口：**
```typescript
interface ChainOptions {
    maxSteps?: number
    reactVerbose?: boolean
    temperature?: number
}
```

### 链式步骤

#### IntentAnalysisStep
- **功能**：分析用户意图，判断是否需要工具调用
- **输出**：`{ mode: 'direct' | 'react', reason: string }`

#### DirectLLMStep
- **功能**：直接LLM回答，流式输出Markdown格式
- **触发条件**：意图分析结果为`direct`

#### ReActExecutionStep
- **功能**：执行ReAct工具调用流程
- **触发条件**：意图分析结果为`react`

#### ResponseEnhancementStep
- **功能**：对ReAct结果进行增强和格式化
- **触发条件**：ReAct执行完成后

## 🔄 处理流程

```
用户消息
    ↓
意图分析 (IntentAnalysisStep)
    ↓
分支判断
    ├─ 直接回答 → DirectLLMStep → 输出结果
    └─ 工具调用 → ReActExecutionStep → ResponseEnhancementStep → 输出结果
```

## 🛠️ 执行策略

仅保留 Prompt 模式：通过提示词约束输出 ReAct JSON；Function 模式已移除。

## 📝 ReAct JSON 格式

```json
{
    "thought": "当前推理步骤的逻辑说明",
    "action": "tool_call | user_input | final_answer",
    "action_input": {
        "tool_name": "工具名（action=tool_call时）",
        "parameters": {}
    },
    "observation": "工具调用返回结果",
    "answer": "最终回答（action=final_answer时）"
}
```

## 🔌 MCP 工具开发

### 创建MCP服务

```typescript
import { MCPServer } from './index.js'

const server = new MCPServer({
    name: 'weather-server',
    version: '1.0.0'
})

server.mcp.tool(
    'getWeather',
    '获取当前天气信息',
    {
        type: 'object',
        properties: {
            city: { type: 'string', description: '城市名称' }
        }
    },
    async args => ({
        content: [{ type: 'text', text: `北京天气：晴天，25°C` }],
        structuredContent: { weather: '晴天', temperature: 25 }
    })
)

await server.listen(3101, 'localhost')
```

### 工具返回格式

```typescript
{
  content: [{ type: 'text', text: '可展示的文本内容' }],
  structuredContent: { /* 结构化数据 */ }
}
```

## 🎨 最佳实践

### 1. 错误处理
```typescript
try {
    for await (const chunk of chain.runChain(messages)) {
        process.stdout.write(chunk)
    }
}
catch (error) {
    console.error('链式处理失败:', error)
}
```

### 2. 超时控制
```typescript
const timeout = setTimeout(() => {
    // 处理超时逻辑
}, 30000)

for await (const chunk of chain.runChain(messages)) {
    process.stdout.write(chunk)
}

clearTimeout(timeout)
```

### 3. 自定义步骤
```typescript
class CustomStep implements ChainStep {
    name = 'custom_step'

    async execute(context: ChainContext): Promise<void> {
    // 自定义逻辑
    }
}

// 在AgentChain中注册
this.steps.push(new CustomStep())
```

## 🔍 调试与监控

### 日志级别
```typescript
// 设置日志级别
process.env.LOG_LEVEL = 'debug' // debug | info | warn | error
```

### 性能监控
```typescript
const startTime = Date.now()
for await (const chunk of chain.runChain(messages)) {
    process.stdout.write(chunk)
}
console.log(`处理耗时: ${Date.now() - startTime}ms`)
```

## 🚨 常见问题

### Q: 如何处理工具调用失败？
A: 在ReActExecutionStep中已包含错误处理，失败时会记录日志并继续执行。

### Q: 如何跳过意图分析？
A: 目前不支持跳过，但可以通过修改ChainOptions添加skipIntentAnalysis选项。

### Q: 如何自定义响应增强逻辑？
A: 可以继承ResponseEnhancementStep类或创建新的步骤类。

### Q: 支持哪些LLM模型？
A: 支持所有符合LangChain BaseLanguageModel接口的模型。

## 📚 相关文档

- [ReAct流程](./docs/react-flow.md)
- [MCP协议文档](https://modelcontextprotocol.io/)

## 🔄 版本历史

- **v2.0.0**: 引入链式处理架构，重构为模块化设计
- **v1.0.0**: 基础ReAct执行器实现

---

如需独立打包发布，可将本目录作为一个独立包输出，并在 `index.ts` 暴露相关类与类型。
