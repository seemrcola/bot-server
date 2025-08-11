# Bot Server

一个基于链式处理架构的智能Agent服务端项目，实现了"Agent + MCP（Model Context Protocol）+ LangChain"的完整解决方案。

## 🚀 核心特性

- **智能链式处理**：意图分析 → 执行 → 增强回复
- **ReAct决策循环**：支持多次 `tool_call` → `observation` → `final_answer`
- **MCP外部工具**：自动发现和调用外部MCP工具服务
- **流式输出**：完整的HTTP文本流输出
- **多执行策略**：支持Prompt和Function两种ReAct模式
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
- **外部MCP服务**: 自动启动并注册（如 `node-external-server`、`weather-external-server`）

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
  "reactVerbose": false,
  "agentName": "main-agent",
  "strategy": "prompt"
}
```

**参数说明：**
- `messages`: LangChain风格消息数组（必须包含至少一条human消息）
- `reactVerbose`（可选，默认false）：
  - `false`: 只返回最终增强后的答案
  - `true`: 返回详细的ReAct JSON步骤
- `agentName`（可选，默认main-agent）: 选择要执行的Agent
- `strategy`（可选）: `prompt`（基于提示词）或 `function`（基于function-calling）

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
    "messages":[{"type":"human","content":"获取系统信息和天气信息"}],
    "reactVerbose": true,
    "strategy": "prompt"
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

### Function 模式
- **适用场景**: 支持Function Calling的模型
- **特点**: 使用模型原生的tool_call功能
- **优势**: 更结构化，Token效率高
- **劣势**: 依赖模型能力

## 🔧 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `LLM_API_KEY` | - | 大模型API密钥 |
| `LLM_MODEL` | `deepseek-chat` | 模型名称 |
| `LLM_BASE_URL` | - | OpenAI兼容API地址 |
| `REACT_STRATEGY` | `prompt` | 默认执行策略 |
| `LOG_LEVEL` | `info` | 日志级别 |

## 🔌 MCP 工具开发

### 创建外部MCP服务

```typescript
import { MCPServer } from './src/agent/index.js';

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
    body: JSON.stringify({ messages: [...] })
  });
  
  const reader = response.body?.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log(new TextDecoder().decode(value));
  }
} catch (error) {
  console.error('请求失败:', error);
}
```

### 2. 超时控制
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch('/api/chat/stream', {
    signal: controller.signal,
    // ... 其他配置
  });
} finally {
  clearTimeout(timeout);
}
```

### 3. 流式处理
```typescript
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  // 处理流式数据
  process.stdout.write(chunk);
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
import { ChainStep, ChainContext } from './src/agent/chain/types.js';

class CustomStep implements ChainStep {
  name = 'custom_step';
  
  async execute(context: ChainContext): Promise<void> {
    // 自定义逻辑
  }
}

// 在AgentChain中注册
this.steps.push(new CustomStep());
```

### 自定义MCP工具

```typescript
// 在 src/external/ 目录下创建新的MCP服务
export async function startCustomServer(port: number, host: string) {
  const server = new MCPServer({ name: 'custom-server', version: '1.0.0' });
  
  server.mcp.tool('customTool', '自定义工具', {}, async () => ({
    content: [{ type: 'text', text: '工具执行结果' }]
  }));
  
  await server.listen(port, host);
}
```

## 🚨 常见问题

### Q: 如何处理工具调用失败？
A: 系统已内置错误处理机制，工具调用失败时会记录日志并继续执行。

### Q: 如何跳过意图分析？
A: 目前不支持跳过，但可以通过修改ChainOptions添加skipIntentAnalysis选项。

### Q: 支持哪些LLM模型？
A: 支持所有符合LangChain BaseLanguageModel接口的模型。

### Q: 如何自定义响应增强逻辑？
A: 可以继承ResponseEnhancementStep类或创建新的步骤类。

### Q: MCP工具如何实现流式输出？
A: 需要工具端分片产出并通过MCP推送，客户端再提供AsyncIterable管道。

## 📚 相关文档

- [Agent模块文档](./src/agent/README.md)
- [架构设计](./docs/architecture.md)
- [流程图](./docs/flow.md)
- [ReAct流程](./docs/react-flow.md)
- [MCP协议文档](https://modelcontextprotocol.io/)

## 🔄 版本历史

- **v2.0.0**: 引入链式处理架构，重构为模块化设计
- **v1.0.0**: 基础ReAct执行器实现

## 📄 许可证

MIT License

---

如有问题或建议，请提交Issue或Pull Request。
