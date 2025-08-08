# Bot Server

轻量示例，展示 Agent + MCP（Model Context Protocol） + LangChain 工具调用的服务端结构。

## 启动

```bash
pnpm install
pnpm dev
```

- 默认 API: `http://localhost:3000`
- 示例外部 MCP Server: `http://localhost:3002/mcp`（随主进程一并启动）

## API

- 健康检查
  - GET `/api/health`
  - 响应：`{ success: true, data: { status, timestamp, uptime } }`

- 流式聊天
  - POST `/api/chat/stream`
  - Body:
    ```json
    {
      "messages": [
        { "_type": "human", "content": "你好" }
      ],
      "sessionId": "optional-session-id"
    }
    ```
  - 响应：`text/plain` 流式文本

## 环境变量
- `PORT`：默认 `3000`
- `LLM_API_KEY`、`LLM_MODEL`、`LLM_BASE_URL`：LangChain OpenAI 兼容配置

## 开发
- 类型检查：`pnpm run type-check`
- 代码规范：`pnpm run lint` / `pnpm run lint:fix`
