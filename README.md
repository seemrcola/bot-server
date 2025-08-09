# Bot Server

一个用于演示“Agent + MCP（Model Context Protocol）+ LangChain”的服务端项目，已实现 ReAct 模式的多步多工具调用。

### 特性
- ReAct 决策循环：支持多次 `tool_call` → `observation` → `final_answer`。
- MCP 外部工具：以 Streamable HTTP 启动多个外部 MCP Server，并在 Agent 启动时自动连接与发现工具。
- 流式输出：HTTP 文本流输出，支持仅输出最终答案或完整 ReAct 轨迹。

---

## 快速开始

```bash
pnpm install
pnpm dev
```

- 默认 API: `http://localhost:3000`
- 外部 MCP Server 会被主进程自动启动并注册（例如 `node-external-server`、`weather-external-server`）。

---

## 使用方式（API）

### 健康检查
- GET `/api/health`
- 响应：`{ success: true, data: { status, timestamp, uptime } }`

### 流式聊天（ReAct 模式）
- POST `/api/chat/stream`
- 请求体：
  ```json
  {
    "messages": [
      { "type": "human", "content": "给我打个招呼。先给我获取系统信息，再给我获取天气信息" }
    ],
    "reactVerbose": false,
    "agentName": "main-agent",
    "strategy": "prompt"
  }
  ```
- 字段说明：
  - `messages`: LangChain 风格消息数组（至少包含一条 human）。
  - `reactVerbose`（可选，默认 false）：
    - `false`：只返回最终 `answer` 文本；
    - `true`：逐步返回严格的 ReAct JSON（含 `thought/action/action_input/observation/answer`）。
  - `agentName`（可选，默认 `main-agent`）：选择要执行的 Agent。
  - `strategy`（可选）：`prompt`（基于提示词 ReAct JSON）或 `function`（基于 function-calling）；若未提供，使用 `REACT_STRATEGY`。
- 响应：`text/plain` 流。根据 `reactVerbose` 不同，返回最终答案或每步 JSON 行。

---

## 目录结构（要点）

```
src/
  agent/
    agent.ts            # Agent：负责外部 MCP 连接与依赖提供（LLM、ClientManager、systemPrompt）
    executors/
      promptBaseToolUse.ReAct.ts   # PromptReActExecutor：基于提示词的 ReAct 执行器
      functionCalling.ReAct.ts     # FunctionReActExecutor：基于 function-calling 的 ReAct 执行器
    mcp/
      client/           # MCP 客户端与管理器（连接、列举工具、按名路由调用）
      server/           # MCP Server 基类与 HTTP 适配（示例外部服务使用）
  controllers/
    chat.controller.ts  # /api/chat/stream 控制器：驱动 ReAct 执行与输出策略
  services/
    chat/chat.service.ts# ChatService：封装 ReAct 执行（Controller 只依赖 Service）
  external/             # 示例 MCP 外部工具服务（Node 信息、天气）
  docs/                 # 架构及流程文档（Mermaid 图）
```

---

## 架构概览

- 控制器 `ChatController` → 调用 `ChatService.runReActStream(messages, { agentName, strategy })` → 选择执行器并执行 ReAct 循环。
- 执行器（`PromptReActExecutor`/`FunctionReActExecutor`）：
  - 读取 `agent.languageModel`、`agent.clientManager`、`agent.systemPromptValue`；
  - 每步向 LLM 发出“严格 JSON 输出”的提示或绑定工具；
  - `action=tool_call` 时通过 `ClientManager.callTool` 调用 MCP 工具，并将返回文本作为 `observation`；
  - `final_answer` 时结束流程。
- `Agent`：
  - 在应用启动时连接外部 MCP Server，发现可用工具；
  - 通过 getter 提供 LLM、ClientManager、systemPrompt 给执行器复用。
 - `AgentManager`：
   - 管理多个 Agent；`ChatService` 通过 `agentName` 选择具体 Agent。

更多细节与流程图，请见：
- `docs/architecture.md`
- `docs/flow.md`
- `docs/react-flow.md`

---

## 环境变量
- `PORT`：默认 `3000`
- `LLM_API_KEY`：大模型 API key
- `LLM_MODEL`：默认 `deepseek-chat`
- `LLM_BASE_URL`：OpenAI 兼容 API base URL
 - `REACT_STRATEGY`：默认执行策略（`prompt` | `function`）

---

## 开发
- 类型检查：`pnpm run type-check`
- 代码规范：`pnpm run lint` / `pnpm run lint:fix`

---

## 示例请求

```bash
curl -N -s -X POST http://localhost:3000/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[{"type":"human","content":"给我打个招呼。先给我获取系统信息，再给我获取天气信息"}],
    "reactVerbose": false
  }'
```
