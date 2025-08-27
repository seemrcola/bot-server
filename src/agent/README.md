# Agent 模块

本目录提供可独立迁移/打包的智能体模块，实现了基于链式处理的Agent架构。

## 🏗️ 架构概览

```
Agent Module/
├── agent.ts              # 核心Agent类：依赖提供者
├── chain/                # 链式处理模块
│   ├── agent-chain.ts    # 主链式处理器
│   ├── types.ts          # 类型定义
│   ├── executors/        # 执行器（内聚子模块）
│   │   ├── react-executor.ts # ReAct执行器
│   │   └── utils.ts          # 执行器工具函数
│   └── steps/            # 处理步骤
│       ├── intent-analysis.ts      # 意图分析
│       ├── direct-llm.ts           # 直接LLM回答
│       ├── react-execution.ts      # ReAct执行
│       └── response-enhancement.ts # 响应增强
├── mcp/                  # MCP协议支持
│   ├── client/           # MCP客户端
│   └── server/           # MCP服务端
└── utils/                # Agent专用工具（模块自治）
    ├── logger.ts         # 日志工具
    └── object-utils.ts   # 对象工具
```

> 说明：为保持 `agent` 模块的单一职责与可复用性，已移除内部的 Agent 管理器。多智能体编排管理请见 `src/orchestration/manager.ts`。

## 🚀 核心特性

- **链式处理架构**：意图分析 → 执行 → 增强回复
- **模块内聚设计**：执行器集成在链式处理模块中，提高可维护性
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
    { name: 'system-mcp-server', version: '1.0.0', url: 'http://localhost:3101/mcp' },
    { name: 'compare-mcp-server', version: '1.0.0', url: 'http://localhost:3102/mcp' },
]

// 创建Agent
const agent = new Agent(llm, servers, systemPrompt)
await agent.ready

// 执行链式处理
const chain = new AgentChain(agent)
const messages = [new HumanMessage('获取系统信息并比较 3 和 5 的大小')]

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

### 链式处理模块导出

```typescript
// 从 chain 模块导出
import {
    AgentChain,
    extractDisplayableTextFromToolResult,
    extractText,
    PromptReActExecutor
} from './chain/index.js'

// 或者从主模块统一导出
import {
    Agent,
    AgentChain,
    PromptReActExecutor
} from './index.js'
```

**新增导出：**
- `PromptReActExecutor` - ReAct执行器（现在集成在chain中）
- `extractText` - 文本提取工具函数
- `extractDisplayableTextFromToolResult` - 工具结果显示函数

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

**架构优化**：执行器已集成在 `chain/executors/` 目录中，提高了模块内聚性和可维护性。

## 📝 ReAct JSON 格式

```json
{
    "thought": "当前推理步骤的逻辑说明",
    "action": "tool_call | final_answer",
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
import { z } from 'zod'
import { MCPServer } from './index.js'

const server = new MCPServer({
    name: 'weather-server',
    version: '1.0.0'
})

server.mcp.registerTool(
    'compare',
    {
        description: '比较两个数字大小',
        parameters: {
            a: z.number().description('第一个数字'),
        }
    },
    async params => ({

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

### 4. 使用内置执行器
```typescript
import { PromptReActExecutor } from './chain/executors/index.js'

// 直接使用ReAct执行器
const executor = new PromptReActExecutor({ agent })
for await (const step of executor.run(messages, { maxSteps: 8 })) {
    console.log(step)
}
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

## 📚 相关文档

- [ReAct流程](./docs/react-flow.md)
- [MCP协议文档](https://modelcontextprotocol.io/)

---

如需独立打包发布，可将本目录作为一个独立包输出，并在 `index.ts` 暴露相关类与类型。
