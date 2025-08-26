# Bot Server

一个基于链式处理架构的智能Agent服务端项目，实现了"Agent + MCP（Model Context Protocol）+ LangChain"的完整解决方案。

## 🚀 核心特性

- **智能链式处理**：意图分析 → 执行 → 增强回复
- **ReAct决策循环**：支持多次 `tool_call` → `observation` → `final_answer`
- **MCP外部工具**：自动发现和调用外部MCP工具服务
- **流式输出**：完整的HTTP文本流输出
- **执行策略**：统一为 Prompt 模式（已移除 Function 模式）
- **响应增强**：自动优化和格式化ReAct结果

## 🏗️ 架构概览

```
Bot Server/
├── src/
│   ├── agent/                 # Agent核心模块
│   │   ├── chain/            # 链式处理（新增）
│   │   │   ├── agent-chain.ts    # 主链式处理器
│   │   │   ├── types.ts          # 类型定义
│   │   │   └── steps/            # 处理步骤
│   │   │       ├── intent-analysis.ts      # 意图分析
│   │   │       ├── direct-llm.ts           # 直接LLM回答
│   │   │       ├── react-execution.ts      # ReAct执行
│   │   │       └── response-enhancement.ts # 响应增强
│   │   ├── executors/        # 执行器（底层实现）
│   │   ├── mcp/              # MCP协议支持
│   │   └── manager.ts        # Agent管理器
│   ├── controllers/          # 控制器层
│   ├── services/             # 服务层
│   ├── routes/               # 路由层
│   ├── middlewares/          # 中间件
│   ├── utils/                # 通用工具
│   ├── external/             # 外部MCP服务示例
│   ├── config/               # 配置管理
│   └── prompts/              # 提示词管理
└── docs/                     # 架构文档
```

## 🎯 快速开始

### 环境准备

```bash
# 克隆项目
git clone <repository-url>
cd bot-server

# 安装依赖
pnpm install

# 设置环境变量
cp .env.example .env
# 编辑 .env 文件，设置你的API密钥
```

### 启动服务

```bash
# 开发模式
pnpm dev

# 生产模式
pnpm build
pnpm start
```

- **默认API地址**: `http://localhost:3000`
- **外部MCP服务**: 自动启动并注册（如 `system-mcp-server`、`compare-mcp-server`、`two-sum-mcp-server`）
- **A2A 路由**: 支持显式指定、LLM 精准路由与回退，详见 `docs/a2a-flow.md`

## ☁️ Serverless 部署与初始化

- 在 Serverless（如 Vercel）环境中，`src/index.ts` 启动阶段会构建全局就绪 Promise `globals.agentManagerReady`，完成后将实例写入 `globals.agentManager`。
- 请求路径不再触发初始化；`ChatService` 在执行前会统一 `await globals.agentManagerReady`，避免冷启动竞态与首包失败。
- 本地开发会主动 `app.listen`；在 Vercel 环境下通过平台注入的 `VERCEL=1` 判断，不主动监听端口，由平台接管。

## 📡 API 文档

### 健康检查

```http
GET /api/health
```

**响应示例：**
```json
{
    "success": true,
    "data": {
        "status": "healthy",
        "timestamp": "2024-01-01T00:00:00.000Z",
        "uptime": 3600
    }
}
```

### 流式聊天（链式处理）

```http
POST /api/chat/stream
Content-Type: application/json
```

**请求体：**
```json
{
    "messages": [
        {
            "type": "human",
            "content": "给我打个招呼，然后获取当前天气信息"
        }
    ],
    "reactVerbose": false
}
```

**参数说明：**
- `messages`: LangChain风格消息数组（必须包含至少一条human消息）
- `reactVerbose`（可选，默认false）：
  - `false`: 只返回最终增强后的答案
  - `true`: 返回详细的ReAct JSON步骤
- `agentName`（可选）: 显式指定要执行的Agent；不传则走 LLM 精准路由与回退

**响应：** `text/plain` 流式输出

### 示例请求

```bash
# 基础聊天
curl -N -X POST http://localhost:3000/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[{"type":"human","content":"你好，请介绍一下自己"}],
    "reactVerbose": false
  }'

# 工具调用
curl -N -X POST http://localhost:3000/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[{"type":"human","content":"获取系统信息并比较 3 和 5 的大小"}],
    "reactVerbose": true
  }'
```

## 🔄 处理流程

```
用户请求
    ↓
ChatController
    ↓
ChatService.runChainStream()
    ↓
AgentChain.runChain()
    ↓
意图分析 (IntentAnalysisStep)
    ↓
分支判断
    ├─ 直接回答 → DirectLLMStep → 流式输出
    └─ 工具调用 → ReActExecutionStep → ResponseEnhancementStep → 流式输出
```

## 🛠️ 执行策略

### Prompt 模式
- **适用场景**: 所有支持JSON输出的模型
- **特点**: 通过提示词约束输出ReAct JSON格式
- **优势**: 通用性强，兼容性好
- **劣势**: Token开销略高

> 说明：已删去 Function 模式；即使客户端传入 `function`，也会走 Prompt 模式。

## 🔧 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `LLM_API_KEY` | - | 大模型API密钥 |
| `LLM_MODEL` | `deepseek-chat` | 模型名称 |
| `LLM_BASE_URL` | - | OpenAI兼容API地址 |
| `REACT_STRATEGY` | `prompt` | 默认执行策略（固定为 prompt） |
| `LLM_PROVIDER` | `deepseek` | LLM厂商选择（如 `deepseek`/`openai`） |
| `LLM_TEMPERATURE` | `0.7` | 采样温度 |
| `LLM_STREAMING` | `true` | 是否流式 |
| `LOG_LEVEL` | `info` | 日志级别 |
| `VERCEL` | - | 部署在 Vercel 时平台会注入为 `1`；用于跳过 `app.listen` |

## 🔌 MCP 工具开发

### 创建外部MCP服务

```typescript
import { MCPServer } from './src/agent/index.js'

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
    const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [/* ... */] })
    })

    const reader = response.body?.getReader()
    while (true) {
        const { done, value } = await reader.read()
        if (done)
            break
        console.log(new TextDecoder().decode(value))
    }
}
catch (error) {
    console.error('请求失败:', error)
}
```

### 2. 超时控制
```typescript
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 30000)

try {
    const response = await fetch('/api/chat/stream', {
        signal: controller.signal,
    // ... 其他配置
    })
}
finally {
    clearTimeout(timeout)
}
```

### 3. 流式处理
```typescript
const reader = response.body?.getReader()
const decoder = new TextDecoder()

while (true) {
    const { done, value } = await reader.read()
    if (done)
        break

    const chunk = decoder.decode(value)
    // 处理流式数据
    process.stdout.write(chunk)
}
```

## 🔍 开发指南

### 代码规范
```bash
# 类型检查
pnpm run type-check

# 代码规范检查
pnpm run lint

# 自动修复
pnpm run lint:fix
```

### 添加新的链式步骤

```typescript
import { ChainContext, ChainStep } from './src/agent/chain/types.js'

class CustomStep implements ChainStep {
    name = 'custom_step'

    async execute(context: ChainContext): Promise<void> {
    // 自定义逻辑
    }
}

// 在AgentChain中注册
this.steps.push(new CustomStep())
```

### 自定义MCP工具

```typescript
// 在 src/external/ 目录下创建新的MCP服务
export async function startCustomServer(port: number, host: string) {
    const server = new MCPServer({ name: 'custom-server', version: '1.0.0' })

    server.mcp.tool('customTool', '自定义工具', {}, async () => ({
        content: [{ type: 'text', text: '工具执行结果' }]
    }))

    await server.listen(port, host)
}
```

## TODO
1. 目前只有正常对话能够记住上下文，工具调用无法记住上下文。 后续支持agent和工具调用单独处理上下文
2. 支持图片识别（需要换一个多模态模型）

## 📚 相关文档

- [Agent模块文档](./src/agent/README.md)
- [ReAct流程](./docs/react-flow.md)
- [A2A 路由/启动流程](./docs/a2a-flow.md)
- [A2A 模块说明](./src/A2A/README.md)
- [MCP协议文档](https://modelcontextprotocol.io/)

## 🔄 版本历史

- **v2.0.0**: 引入链式处理架构，重构为模块化设计
- **v1.0.0**: 基础ReAct执行器实现

## 📄 许可证

MIT License

---

如有问题或建议，请提交Issue或Pull Request。
