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
| `reactInitialSteps` | `object[]` | ❌ | - | 恢复 ReAct 推理用的历史步骤（见“人机协同”） |

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
            "content": "获取当前天气和系统信息"
        }
    ],
    "reactVerbose": true
}
```

**人机协同（恢复执行）：**
```json
{
    "messages": [
        { "type": "human", "content": "上次澄清问题的补充答案：北京" }
    ],
    "reactVerbose": true,
    "reactInitialSteps": [
        {
            "thought": "需要确认城市名",
            "action": "user_input",
            "observation": "北京" // 服务端可在恢复前写入用户补充
        },
        {
            "thought": "准备查询天气",
            "action": "tool_call",
            "action_input": { "tool_name": "getWeather", "parameters": { "city": "北京" } }
        }
    ]
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
{"thought":"分析用户需求，需要获取天气和系统信息","action":"tool_call","action_input":{"tool_name":"getSystemInfo","parameters":{}}}
{"thought":"系统信息获取完成，现在获取天气信息","action":"tool_call","action_input":{"tool_name":"getWeather","parameters":{"city":"北京"}},"observation":"系统信息：Node.js v18.0.0, 内存使用: 512MB"}
{"thought":"所有信息已收集完成，整理回答","action":"final_answer","answer":"根据获取的信息：\n\n**系统信息：**\n- Node.js v18.0.0\n- 内存使用: 512MB\n\n**天气信息：**\n- 北京：晴天，25°C\n\n所有信息已为您整理完毕！","observation":"天气信息：北京晴天，25°C"}
```

> 当某一步返回 `{"action":"user_input"}` 时，客户端应保存本轮的 ReAct 步骤（react_steps），向用户展示澄清问题；用户补充后，将补充内容写入上一次 `user_input` 步骤的 `observation`，并把整包步骤作为 `reactInitialSteps` 传入新一轮请求，即可恢复推理。

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
    "action": "tool_call | user_input | final_answer",
    "action_input": {
        "tool_name": "工具名（action=tool_call时）",
        "parameters": {}
    },
    "observation": "工具调用返回结果",
    "answer": "最终回答（action=final_answer时）"
}
```

### 人机协同（user_input 挂起与恢复）

1) 当 ReAct 返回 `action=user_input` 时：

 - 本轮流式输出停止；客户端可选接收到该步 JSON
 - 客户端需要缓存“本轮所有 ReAct 步骤”为 `react_steps`
 - 展示澄清问题，等待用户补充

2) 用户补充后：

 - 将 `react_steps` 中最后一个 `user_input` 步骤的 `observation` 设置为用户补充文本
 - 以 `reactInitialSteps` 传回 `POST /api/chat/stream`，并把用户补充也作为最后一条 `messages`
 - 服务端会把 `reactInitialSteps` 透传给执行器 `initialSteps`，从该状态继续 ReAct 推理，直到出现 `final_answer`

3) 增强回复 gating：

 - 只有在 `react_steps` 中出现 `action=final_answer` 且含 `answer` 时，才进行 `ResponseEnhancementStep`

## 🛠️ 执行策略

### Prompt 模式
- 通过提示词约束输出 ReAct JSON 格式（当前仅保留 Prompt 模式）

## 🔌 MCP 工具

### 内置工具

系统自动启动并注册以下MCP工具服务：

- **node-external-server**: 提供系统信息查询
- **weather-external-server**: 提供天气信息查询

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

**人机协同（前端恢复执行范例）：**
```javascript
// 一个简单的“挂起-恢复”控制流示例
let cachedReactSteps = []

async function callChat(messages, options = {}) {
    const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages,
            reactVerbose: true, // 方便拿到每步 JSON
            reactInitialSteps: options.reactInitialSteps || undefined,
        })
    })

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let finalAnswer = ''
    let lastChunk = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done)
            break
        const chunk = decoder.decode(value)
        lastChunk = chunk

        // 逐行拆分，尝试累积 ReAct 步骤
        const lines = chunk.split('\n').filter(Boolean)
        for (const line of lines) {
            try {
                const step = JSON.parse(line)
                cachedReactSteps.push(step)
                if (step.action === 'final_answer' && typeof step.answer === 'string') {
                    finalAnswer = step.answer
                }
            }
            catch (_) {
                // 非 JSON（可能是增强后的 Markdown），直接展示
                finalAnswer += line
            }
        }
    }

    return { finalAnswer, lastChunk }
}

// 初次调用
async function main() {
    const { finalAnswer } = await callChat([
        { type: 'human', content: '查询北京天气，若缺城市就问我' }
    ])

    // 如果没有最终答案，说明可能挂起等待澄清
    if (!finalAnswer) {
    // 展示澄清 UI，等待用户补充
        const userClarification = prompt('请输入城市名')

        // 将补充内容写入上一次 user_input 步骤的 observation
        for (let i = cachedReactSteps.length - 1; i >= 0; i--) {
            if (cachedReactSteps[i].action === 'user_input') {
                cachedReactSteps[i].observation = userClarification
                break
            }
        }

        // 以 reactInitialSteps 恢复执行，同时把自然语言补充也写进 messages
        const { finalAnswer: resumed } = await callChat([
            { type: 'human', content: `城市补充：${userClarification}` }
        ], {
            reactInitialSteps: cachedReactSteps
        })

        console.log('最终：', resumed)
    }
    else {
        console.log('最终：', finalAnswer)
    }
}

main()
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
