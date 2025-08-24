# Bot Server API 文档

## 📋 概述

Bot Server 提供了基于链式处理架构的智能Agent API，支持意图分析、ReAct工具调用和响应增强等功能。

## 🔗 基础信息

- **基础URL**: `http://localhost:3000`
- **内容类型**: `application/json`
- **响应格式**: `text/plain` (流式) 或 `application/json`

> 部署在 Vercel 等 Serverless 平台时，应用在冷启动阶段会完成 A2A 初始化；请求路径会等待 `globals.agentManagerReady`，避免未初始化错误。

## 📡 API 端点

### 1. 健康检查

检查服务状态和运行时间。

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

**状态码：**
- `200 OK`: 服务正常运行
- `500 Internal Server Error`: 服务异常

---

### 2. 流式聊天

主要的聊天接口，支持链式处理和工具调用。

```http
POST /api/chat/stream
Content-Type: application/json
```

#### 请求参数

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `messages` | `Message[]` | ✅ | - | LangChain风格消息数组 |
| `reactVerbose` | `boolean` | ❌ | `false` | 是否输出详细ReAct步骤 |
| `agentName` | `string` | ❌ | - | 显式指定要执行的 Agent；通常不指定，由系统进行 LLM 路由 |

#### 消息格式

```typescript
interface Message {
    type: 'human' | 'ai' | 'system'
    content: string
}
```

#### 请求示例

**基础聊天：**
```json
{
    "messages": [
        {
            "type": "human",
            "content": "你好，请介绍一下自己"
        }
    ],
    "reactVerbose": false
}
```

**工具调用：**
```json
{
    "messages": [
        {
            "type": "human",
            "content": "获取系统信息并比较 3 和 5 的大小"
        }
    ],
    "reactVerbose": true
}
```

#### 响应格式

**reactVerbose: false (默认)**
```
你好！我是一个AI助手，很高兴为您服务。

我可以帮助您：
- 回答问题和提供信息
- 调用外部工具获取实时数据
- 进行多步推理和工具编排

有什么我可以帮助您的吗？
```

**reactVerbose: true**
```
{"thought":"先获取系统信息","action":"tool_call","action_input":{"tool_name":"getSystemInfo","parameters":{}}}
{"thought":"系统信息获取完成，现在比较两个数","action":"tool_call","action_input":{"tool_name":"compare","parameters":{"num1":3,"num2":5}},"observation":"两个数比较的结果是 num1 小于 num2"}
{"thought":"整理回答","action":"final_answer","answer":"当前 Node.js 版本 …；比较结果：3 小于 5。"}
```

#### 状态码

- `200 OK`: 请求成功，开始流式响应
- `400 Bad Request`: 请求参数错误
- `500 Internal Server Error`: 服务器内部错误

#### 错误响应

```json
{
    "error": "messages are required in the request body and must be a non-empty array."
}
```

## 🔄 处理流程

### 链式处理架构

```
用户请求
    ↓
意图分析 (IntentAnalysisStep)
    ↓
分支判断
    ├─ 直接回答 → DirectLLMStep → 流式输出
    └─ 工具调用 → ReActExecutionStep → [若 final_answer 存在 → ResponseEnhancementStep] → 流式输出
```

### ReAct JSON 格式

当 `reactVerbose: true` 时，每个步骤返回的JSON格式：

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

## 🛠️ 执行策略

### Prompt 模式
- 通过提示词约束输出 ReAct JSON 格式（当前仅保留 Prompt 模式）

## 🔌 MCP 工具

### 内置工具

Leader 启动时会自动启动并注册以下 MCP 工具服务：

- `system-mcp-server`: `getSystemInfo()` 获取当前 Node.js 版本等
- `compare-mcp-server`: `compare(num1:number, num2:number)` 比较两个数大小
- `two-sum-mcp-server`: `twoSum(num1:number, num2:number)` 两数求和

### 工具返回格式

```typescript
{
  content: [{ type: 'text', text: '可展示的文本内容' }],
  structuredContent: { /* 结构化数据 */ }
}
```

## 📝 使用示例

### cURL 示例

**基础聊天：**
```bash
curl -N -X POST http://localhost:3000/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[{"type":"human","content":"你好，请介绍一下自己"}],
    "reactVerbose": false
  }'
```

**工具调用：**
```bash
curl -N -X POST http://localhost:3000/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[{"type":"human","content":"获取系统信息和天气信息"}],
    "reactVerbose": true
  }'
```

### JavaScript 示例

**基础使用：**
```javascript
const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        messages: [{ type: 'human', content: '你好' }],
        reactVerbose: false
    })
})

const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
    const { done, value } = await reader.read()
    if (done)
        break

    const chunk = decoder.decode(value)
    console.log(chunk)
}
```

**错误处理：**
```javascript
try {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [...] })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  // 处理流式响应...
} catch (error) {
  console.error('请求失败:', error);
}
```

**超时控制：**
```javascript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch('/api/chat/stream', {
    signal: controller.signal,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [...] })
  });

  // 处理响应...
} finally {
  clearTimeout(timeout);
}
```

## 🚨 错误处理

### 常见错误

| 错误码 | 错误信息 | 解决方案 |
|--------|----------|----------|
| 400 | `messages are required...` | 确保请求包含有效的messages数组 |
| 500 | `AgentManager not initialized` | 检查服务启动状态 |
| 500 | `Agent not found` | 检查agentName参数 |

### 错误响应格式

```json
{
    "error": "错误描述信息"
}
```

## 🔧 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `LLM_API_KEY` | - | 大模型API密钥 |
| `LLM_MODEL` | `deepseek-chat` | 模型名称 |
| `LLM_BASE_URL` | - | OpenAI兼容API地址 |
| `LLM_PROVIDER` | `deepseek` | LLM厂商选择（如 `deepseek`/`openai`） |
| `LLM_TEMPERATURE` | `0.7` | 采样温度 |
| `LLM_STREAMING` | `true` | 是否流式 |
| `LOG_LEVEL` | `info` | 日志级别 |

## 📊 性能指标

### 响应时间
- **直接回答**: 通常 1-3 秒
- **工具调用**: 通常 3-8 秒（取决于工具响应时间）

### 并发支持
- 支持多用户并发访问
- 每个请求独立处理，互不影响

### 资源使用
- 内存使用: 约 50-100MB 基础使用
- CPU使用: 根据并发量动态调整

## 🔍 调试与监控

### 日志级别
```bash
# 设置详细日志
export LOG_LEVEL=debug

# 设置错误日志
export LOG_LEVEL=error
```

### 健康检查
```bash
# 检查服务状态
curl http://localhost:3000/api/health
```

## 📚 相关文档

- [项目README](./README.md)
- [Agent模块文档](./src/agent/README.md)
- [架构设计](./docs/architecture.md)
- [MCP协议文档](https://modelcontextprotocol.io/)

---

如有问题或建议，请提交Issue或Pull Request。
