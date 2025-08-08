## Agent 架构 UML 类图

下图展示了核心类之间的关系与职责边界（Agent、ClientManager、MCP 客户端/服务器、服务与入口等）。

```mermaid
classDiagram
  class Agent {
    - llm: BaseLanguageModel
    - systemPrompt: string
    - externalClientManager: ClientManager
    - allTools: ExternalTool[]
    + ready: Promise<void>
    + processMessageStream(messages: BaseMessage[], sessionId?): AsyncIterable<string>
    - _analyzeUserIntent(lastMessage: BaseMessage): ToolCall | null
    - _executeToolCall(toolCall: ToolCall): AsyncIterable<string>
    - _executeConventionalCall(messages: BaseMessage[]): AsyncIterable<string>
  }

  class ClientManager {
    - clients: Map<string, MCPHttpClient>
    - toolToServerMap: Map<string, string>
    - discoveredTools: ExternalTool[]
    + connect(serverConfigs: ExternalServerConfig[]): Promise<void>
    + getAllTools(): Promise<ExternalTool[]>
    + callTool(toolName: string, args: any): Promise<any>
  }

  class MCPHttpClient {
    - client: McpClient
    + connect(url: string): Promise<void>
    + listTools(): Promise<any>
    + callTool(name: string, parameters: any): Promise<any>
  }

  class MCPServer {
    + listen(port: number, host: string): Promise<void>
    + mcp: McpServer
  }

  class ChatService {
    + runChatStream(messages: BaseMessage[], sessionId?): Promise<AsyncIterable<string>>
  }

  class Globals {
    + agent?: Agent
  }

  class MainServer {
    + startServer(): Promise<void>
  }

  class ExternalServerConfig {
    name: string
    version: string
    url: string
  }

  class ExternalTool {
    name: string
    description?: string
    inputSchema?: unknown
  }

  class BaseLanguageModel
  class BaseMessage
  class SystemMessage
  class ChatOpenAI

  Agent --> ClientManager : uses
  Agent --> BaseLanguageModel : uses
  Agent o--> ExternalTool : binds tools
  ClientManager --> MCPHttpClient : manages *
  ClientManager o--> ExternalTool : caches *
  ChatService --> Agent : uses
  MainServer --> ChatService : routes
  MainServer --> Agent : creates
  Globals --> Agent : holds
  MainServer --> ChatOpenAI : constructs
  MCPServer <.. MainServer : started (test)
  Agent ..> SystemMessage : system prompt
```

说明：
- Agent 负责协调 LLM 与工具调用，暴露流式处理接口，并在构造后异步完成外部工具初始化（`ready`）。
- ClientManager 统一管理多个 MCP 客户端，发现并缓存工具列表，提供按工具名路由的调用能力。
- MCPServer 作为示例外部工具服务由入口进程启动，Agent 通过 HTTP MCP 协议访问。
- `MainServer` 初始化 LLM、Agent、路由与中间件；`ChatService` 面向控制器聚合对 Agent 的调用。

