## Agent 使用说明

本目录提供可独立迁移/打包的智能体模块，包含：
- `Agent`: 统一提供 LLM、外部工具管理（MCP）与系统提示词
- 执行器（两种实现，可二选一）：
  - `PromptReActExecutor`：基于 Prompt 的 ReAct 多步推理与多工具编排（模型输出自定义 JSON）
  - `FunctionReActExecutor`：基于 Function Calling 的 ReAct（模型原生 tool_call）
- `MCPServer`: 简易 MCP 服务端基类，便于注册/暴露自定义工具

### 核心能力
- 多步推理（ReAct）与多工具串并行编排
- 流式按步输出（AsyncIterable<string>），每步是一个标准 JSON（见下方结构）
- 通过 MCP 发现与调用外部工具

### 安装与前置
Agent 依赖 LangChain 与 MCP SDK，推荐在外部工程中安装：

```bash
pnpm add @langchain/core @langchain/deepseek @modelcontextprotocol/sdk
```

你可以使用任意符合 `BaseLanguageModel` 的 LLM 实现。下面示例使用 `@langchain/deepseek` 提供的 `ChatDeepSeek`。

### 快速开始

```ts
import { Agent, PromptReActExecutor, FunctionReActExecutor, MCPServer } from './index.js';
import { ChatDeepSeek } from '@langchain/deepseek';
import type { ExternalServerConfig } from './mcp/client/manager.js';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

// 1) 准备 LLM（可替换为你自己的 LLM 包装器）
const llm = new ChatDeepSeek({
  apiKey: process.env.LLM_API_KEY ?? '',
  model: process.env.LLM_MODEL ?? 'deepseek-chat',
  temperature: 0.7,
  streaming: true,
  configuration: { baseURL: process.env.LLM_BASE_URL ?? '' },
});

// 2) 启动/声明 MCP 外部工具服务器（也可在别处启动后传入配置）
const servers: ExternalServerConfig[] = [
  { name: 'node-external-server', version: '1.0.0', url: 'http://localhost:3101/mcp' },
  { name: 'weather-external-server', version: '1.0.0', url: 'http://localhost:3102/mcp' },
];

// 3) 创建 Agent，并等待就绪（会连接 MCP 并发现工具）
const systemPrompt = '你是一个乐于助人的 AI 助手。';
const agent = new Agent(llm, servers, systemPrompt);
await agent.ready;

// 4) 以 ReAct 模式执行（流式按步输出 JSON 文本）
// 选择一种执行器：PromptReActExecutor（默认）或 FunctionReActExecutor
const executor = new PromptReActExecutor({ agent });
// 或：
// const executor = new FunctionReActExecutor({ agent });
const messages = [
  new HumanMessage('给我打个招呼。先获取系统信息，再获取天气信息')
];

for await (const step of executor.run(messages, { maxSteps: 8 })) {
  // 每个 step 是一个 JSON 字符串（见下方结构）。
  // 你可以在上层（例如 controller）做“友好增强”与格式化展示。
  process.stdout.write(step + '\n');
}
```

### ReAct 步骤 JSON 结构

```json
{
  "thought": "当前推理步骤的逻辑说明",
  "action": "tool_call | user_input | final_answer",
  "action_input": {
    "tool_name": "工具名（若 action=tool_call）",
    "parameters": {}
  },
  "observation": "上一步工具调用的返回结果（仅后续步骤需要）",
  "answer": "最终回答（若 action=final_answer）"
}
```

说明：
- 当 `action=tool_call` 时，必须包含 `action_input.tool_name` 与 `action_input.parameters`。
- 当 `action=final_answer` 时，必须包含 `answer`。
- 当需要用户澄清时，`action=user_input` 并在 `thought` 中说明所需补充信息。

### 在本地快速自建 MCP 工具

```ts
import { MCPServer } from './index.js';

// 1) 创建 MCP 服务并注册工具
const server = new MCPServer({ name: 'weather-external-server', version: '1.0.0' });

server.mcp.tool(
  'getWeather',
  '获取当前天气',
  {},
  async () => ({
    content: [{ type: 'text', text: '当前天气是 晴天' }],
    structuredContent: { weather: '晴天' }
  })
);

// 2) 监听 HTTP
await server.listen(3102, 'localhost');
```

工具返回格式推荐：

```ts
{
  content: [{ type: 'text', text: '可展示的文本' }],
  structuredContent: { /* 任意结构化数据 */ }
}
```

`PromptReActExecutor`/`FunctionReActExecutor` 均会从 `content` 中提取可展示文本，填入 `observation`。

### 友好增强（展示层建议）
Agent/Executor 产出的是“标准 JSON 步骤”。建议在上层（如 Web Controller）做“友好增强”，例如：
- 在工具调用前输出“正在调用工具: 名称，参数 …”
- 在工具完成后输出“工具结果: …”
- 在最终回答后拼接“信息小结”（聚合各步 `observation`）

这样可保持 Agent 的通用性与可迁移性，不与具体展示风格耦合。

### 常见问题

- 工具结果能否“真流式”？
  - 需要工具端分片产出并通过 MCP 推送，客户端再提供 `AsyncIterable` 管道。目前默认是一次性结果；可先输出“调用中…”心跳提高体验。

### 最佳实践
- 在接入层（Controller）做输出增强与本地化；Agent 仅产出标准步骤与结果。
- 为 LLM/工具调用加超时与有限重试；对 `action_input.parameters` 做基本校验。
- 使用 `agent.ready` 确保 MCP 工具已完成发现。



### 对外 API（简表）
- `class Agent(llm: BaseLanguageModel, servers: ExternalServerConfig[], systemPrompt: string)`
  - `ready: Promise<void>`: 完成外部服务连接与工具发现
  - `languageModel`, `clientManager`, `systemPromptValue`

- `class PromptReActExecutor({ agent })`
  - `run(messages: BaseMessage[], { maxSteps?: number }): AsyncIterable<string>`
- `class FunctionReActExecutor({ agent })`
  - `run(messages: BaseMessage[], { maxSteps?: number }): AsyncIterable<string>`

- `class MCPServer({ name, version })`
  - `mcp.tool(name, description, inputSchema, handler)`
  - `listen(port, host)`

如需独立打包发布，可将本目录作为一个独立包输出，并在 `index.ts` 暴露上述类与类型。

### 执行策略选择
- Prompt 模式：适用于所有模型；以提示词约束输出 ReAct JSON，通用但 token 开销略高。
- Function 模式：依赖模型的 function-calling 能力；工具调用更结构化、更省 token。
在本项目服务层中，可通过请求参数 `strategy: 'prompt' | 'function'` 或环境变量 `REACT_STRATEGY` 选择策略。


