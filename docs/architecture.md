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
    + languageModel: BaseLanguageModel
    + clientManager: ClientManager
    + systemPromptValue: string
    + processMessageStream(messages: BaseMessage[], sessionId?): AsyncIterable<string>
    - _analyzeUserIntent(lastMessage: BaseMessage): ToolCall | null
    - _executeToolCall(toolCall: ToolCall): AsyncIterable<string>
    - _executeConventionalCall(messages: BaseMessage[]): AsyncIterable<string>
  }

  class ReActExecutor {
    - llm: BaseLanguageModel
    - clientManager: ClientManager
    - systemPrompt: string
    + run(messages: BaseMessage[], options?): AsyncIterable<string>
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
  ReActExecutor --> ClientManager : uses
  ReActExecutor --> BaseLanguageModel : uses
  ClientManager --> MCPHttpClient : manages *
  ClientManager o--> ExternalTool : caches *
  MainServer --> Agent : creates
  Globals --> Agent : holds
  MainServer --> ChatOpenAI : constructs
  MCPServer <.. MainServer : started (test)
  Agent ..> SystemMessage : system prompt
  ChatController ..> ReActExecutor : uses
  ChatController ..> Agent : reads deps (getters)
```

说明：
- 现已由 `ChatController` 直接使用 `ReActExecutor` 驱动“多步多工具”的 ReAct 流程；通过 `globals.agent` 暴露的只读 getter 复用同一 `LLM`/`ClientManager`/`systemPrompt`。
- `Agent` 仍保留原单步能力与工具绑定逻辑（兼容/参考），但默认接口已切换到 ReAct。
- `ClientManager` 统一管理多个 MCP 客户端；`MCPServer` 为示例外部工具服务，采用 Streamable HTTP 传输。

