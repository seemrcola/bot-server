## Agent 架构 UML 类图

下图展示了核心类之间的关系与职责边界（Agent、AgentManager、ClientManager、MCP 客户端/服务器、服务与入口等）。

```mermaid
classDiagram
  class Agent {
    - llm: BaseLanguageModel
    - systemPrompt: string
    - externalClientManager: ClientManager
    + ready: Promise<void>
    + languageModel: BaseLanguageModel
    + clientManager: ClientManager
    + systemPromptValue: string
    + listTools(): Promise<ExternalTool[]>
  }

  class AgentManager {
    - agents: Map<string, Agent>
    + addAgent(name: string, agent: Agent): void
    + getAgent(name: string): Agent | undefined
    + listAgentNames(): string[]
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
    + agentManager?: AgentManager
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
  ReActExecutor --> ClientManager : uses
  ReActExecutor --> BaseLanguageModel : uses
  ClientManager --> MCPHttpClient : manages *
  ClientManager o--> ExternalTool : caches *
  MainServer --> AgentManager : creates
  AgentManager --> Agent : manages *
  Globals --> AgentManager : holds
  MainServer --> ChatOpenAI : constructs
  MCPServer <.. MainServer : started (test)
  Agent ..> SystemMessage : system prompt
  ChatController ..> ReActExecutor : uses
  ChatController ..> AgentManager : selects agent
```

说明：
- `ChatController` 通过 `ChatService` 调用 `AgentManager.getAgent(agentName)` 选择具体 Agent，再用 `ReActExecutor` 驱动 ReAct 流程。
- `Agent` 负责提供 `LLM`、`ClientManager`、`systemPrompt` 等依赖，不再缓存 `allTools`。
- `ClientManager` 统一管理多个 MCP 客户端；`MCPServer` 为示例外部工具服务，采用 Streamable HTTP 传输。

