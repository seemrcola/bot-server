# Agent 模块 API 文档

## 📋 概述

Agent模块提供了基于链式处理架构的智能体实现，支持意图分析、ReAct工具调用和响应增强等功能。

## 🏗️ 模块结构

```
agent/
├── agent.ts              # 核心Agent类
├── chain/                # 链式处理模块
│   ├── agent-chain.ts    # 主链式处理器
│   ├── types.ts          # 类型定义
│   └── steps/            # 处理步骤
│       ├── intent-analysis.ts      # 意图分析
│       ├── direct-llm.ts           # 直接LLM回答
│       ├── react-execution.ts      # ReAct执行
│       └── response-enhancement.ts # 响应增强
├── executors/            # 执行器
│   ├── promptBaseToolUse.ReAct.ts  # Prompt模式ReAct
│   ├── functionCalling.ReAct.ts    # 已移除，统一使用 Prompt 模式
│   └── utils.ts          # 执行器工具
├── mcp/                  # MCP协议支持
│   ├── client/           # MCP客户端
│   └── server/           # MCP服务端
└── manager.ts            # Agent管理器
```

## 🔧 核心类

### Agent 类

核心Agent类，负责提供LLM、MCP客户端和系统提示词。

```typescript
class Agent {
  constructor(
    llm: BaseLanguageModel,
    externalServers: ExternalServerConfig[] = [],
    systemPrompt: string
  )
}
```

#### 构造函数参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `llm` | `BaseLanguageModel` | ✅ | LangChain语言模型实例 |
| `externalServers` | `ExternalServerConfig[]` | ❌ | 外部MCP服务器配置 |
| `systemPrompt` | `string` | ✅ | 系统提示词 |

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `ready` | `Promise<void>` | 初始化完成Promise |
| `languageModel` | `BaseLanguageModel` | LLM实例 |
| `clientManager` | `ClientManager` | MCP客户端管理器 |
| `systemPromptValue` | `string` | 系统提示词 |

#### 方法

| 方法 | 返回类型 | 说明 |
|------|----------|------|
| `listTools()` | `Promise<ExternalTool[]>` | 获取可用工具列表 |

#### 使用示例

```typescript
import { Agent } from './agent/index.js';
import { ChatDeepSeek } from '@langchain/deepseek';

const llm = new ChatDeepSeek({
  apiKey: process.env.LLM_API_KEY,
  model: 'deepseek-chat',
  temperature: 0.7,
  streaming: true,
});

const agent = new Agent(llm, [], '你是一个乐于助人的AI助手。');
await agent.ready;

const tools = await agent.listTools();
console.log('可用工具:', tools);
```

### AgentChain 类

链式处理器，实现完整的处理流程。

```typescript
class AgentChain {
  constructor(agent: Agent)
  
  runChain(
    messages: BaseMessage[],
    options?: ChainOptions
  ): AsyncIterable<string>
}
```

#### 构造函数参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `agent` | `Agent` | ✅ | Agent实例 |

#### ChainOptions 接口

```typescript
interface ChainOptions {
  maxSteps?: number;           // 最大执行步数，默认8
  // 统一使用 Prompt 策略，已移除 function
  reactVerbose?: boolean;      // 是否输出详细ReAct步骤
}
```

#### 使用示例

```typescript
import { AgentChain } from './agent/index.js';
import { HumanMessage } from '@langchain/core/messages';

const chain = new AgentChain(agent);
const messages = [new HumanMessage('你好，请介绍一下自己')];

for await (const chunk of chain.runChain(messages, {
  maxSteps: 8,
  reactVerbose: false
})) {
  process.stdout.write(chunk);
}
```

## 🔄 链式步骤

### IntentAnalysisStep

意图分析步骤，判断用户是否需要使用工具。

```typescript
class IntentAnalysisStep implements ChainStep {
  name = 'intent_analysis';
  
  async execute(context: ChainContext): Promise<void>
}
```

**功能：**
- 分析用户消息内容
- 对比可用工具列表
- 判断是否需要工具调用
- 返回 `{ mode: 'direct' | 'react', reason: string }`

### DirectLLMStep

直接LLM回答步骤，用于不需要工具的场景。

```typescript
class DirectLLMStep implements ChainStep {
  name = 'direct_llm';
  
  async *execute(context: ChainContext): AsyncIterable<string>
}
```

**功能：**
- 直接调用LLM生成回答
- 流式输出Markdown格式内容
- 适用于知识问答、总结等场景

### ReActExecutionStep

ReAct执行步骤，处理需要工具调用的场景。

```typescript
class ReActExecutionStep implements ChainStep {
  name = 'react_execution';
  
  async *execute(context: ChainContext): AsyncIterable<string>
}
```

**功能：**
- 执行ReAct推理循环
- 支持Prompt和Function两种模式
- 调用MCP工具并处理结果
- 流式输出执行过程

### ResponseEnhancementStep

响应增强步骤，优化ReAct执行结果。

```typescript
class ResponseEnhancementStep implements ChainStep {
  name = 'response_enhancement';
  
  async *execute(context: ChainContext): AsyncIterable<string>
}
```

**功能：**
- 解析ReAct执行结果
- 提取最终答案和工具调用信息
- 生成用户友好的Markdown回答
- 流式输出增强后的内容

## 🛠️ 执行器

### PromptReActExecutor

基于提示词的ReAct执行器。

```typescript
class PromptReActExecutor {
  constructor(params: { agent: Agent })
  
  run(
    messages: BaseMessage[],
    options?: ReActExecutorOptions
  ): AsyncIterable<string>
}
```

**特点：**
- 通过提示词约束输出JSON格式
- 适用于所有支持JSON输出的模型
- 通用性强，兼容性好

### FunctionReActExecutor

基于Function Calling的ReAct执行器。

```typescript
class FunctionReActExecutor {
  constructor(params: { agent: Agent })
  
  run(
    messages: BaseMessage[],
    options?: ReActExecutorOptions
  ): AsyncIterable<string>
}
```

**特点：**
- 使用模型原生的tool_call功能
- 更结构化，Token效率高
- 依赖模型Function Calling能力

## 🔌 MCP 支持

### MCPServer 类

MCP服务端基类，用于创建外部工具服务。

```typescript
class MCPServer {
  constructor(config: { name: string; version: string })
  
  mcp.tool(
    name: string,
    description: string,
    inputSchema: unknown,
    handler: (args: any) => Promise<any>
  )
  
  listen(port: number, host: string): Promise<void>
}
```

#### 使用示例

```typescript
import { MCPServer } from './agent/index.js';

const server = new MCPServer({ 
  name: 'weather-server', 
  version: '1.0.0' 
});

server.mcp.tool(
  'getWeather',
  '获取当前天气信息',
  {
    type: 'object',
    properties: {
      city: { type: 'string', description: '城市名称' }
    }
  },
  async (args) => ({
    content: [{ type: 'text', text: `北京天气：晴天，25°C` }],
    structuredContent: { weather: '晴天', temperature: 25 }
  })
);

await server.listen(3101, 'localhost');
```

### ClientManager 类

MCP客户端管理器，负责连接和管理外部工具。

```typescript
class ClientManager {
  connect(servers: ExternalServerConfig[]): Promise<void>
  getAllTools(): Promise<ExternalTool[]>
  callTool(name: string, args: Record<string, unknown>): Promise<any>
}
```

## 📝 类型定义

### ChainContext

链式处理上下文。

```typescript
interface ChainContext {
  messages: BaseMessage[];
  agent: Agent;
  options: ChainOptions;
  intentResult?: IntentResult;
  reactResults?: string[];
  finalAnswer?: string;
}
```

### ChainStep

链式步骤接口。

```typescript
interface ChainStep {
  name: string;
  execute(context: ChainContext): Promise<void> | AsyncIterable<string>;
}
```

### IntentResult

意图分析结果。

```typescript
interface IntentResult {
  mode: 'direct' | 'react';
  reason: string;
}
```

### ExternalServerConfig

外部服务器配置。

```typescript
interface ExternalServerConfig {
  name: string;
  version: string;
  url: string;
}
```

### ExternalTool

外部工具定义。

```typescript
interface ExternalTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}
```

## 🎨 最佳实践

### 1. 错误处理

```typescript
try {
  const chain = new AgentChain(agent);
  for await (const chunk of chain.runChain(messages)) {
    process.stdout.write(chunk);
  }
} catch (error) {
  console.error('链式处理失败:', error);
  // 实现错误恢复逻辑
}
```

### 2. 超时控制

```typescript
const timeout = setTimeout(() => {
  // 处理超时逻辑
}, 30000);

try {
  for await (const chunk of chain.runChain(messages)) {
    process.stdout.write(chunk);
  }
} finally {
  clearTimeout(timeout);
}
```

### 3. 自定义步骤

```typescript
import { ChainStep, ChainContext } from './chain/types.js';

class CustomStep implements ChainStep {
  name = 'custom_step';
  
  async execute(context: ChainContext): Promise<void> {
    // 自定义逻辑
    console.log('执行自定义步骤');
  }
}

// 在AgentChain中注册
this.steps.push(new CustomStep());
```

### 4. 性能监控

```typescript
const startTime = Date.now();
for await (const chunk of chain.runChain(messages)) {
  process.stdout.write(chunk);
}
console.log(`处理耗时: ${Date.now() - startTime}ms`);
```

## 🔍 调试与监控

### 日志配置

```typescript
// 设置日志级别
process.env.LOG_LEVEL = 'debug'; // debug | info | warn | error

// 创建日志记录器
import { createLogger } from './utils/logger.js';
const logger = createLogger('MyModule');
```

### 性能监控

```typescript
// 监控工具调用性能
const toolStartTime = Date.now();
const result = await agent.clientManager.callTool('getWeather', { city: '北京' });
console.log(`工具调用耗时: ${Date.now() - toolStartTime}ms`);
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

### Q: 如何添加新的MCP工具？
A: 创建新的MCPServer实例，注册工具，并在Agent初始化时传入配置。

## 📚 相关文档

- [项目README](../README.md)
- [顶层API文档](../API.md)
- [架构设计](../docs/architecture.md)
- [MCP协议文档](https://modelcontextprotocol.io/)

---

如有问题或建议，请提交Issue或Pull Request。 
