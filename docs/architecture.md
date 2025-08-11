## Agent 架构 UML 类图

下图展示了核心类之间的关系与职责边界（Agent、AgentManager、AgentChain、链式步骤、MCP 客户端/服务器、服务与入口等）。

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

  class AgentChain {
    - agent: Agent
    - steps: ChainStep[]
    + runChain(messages: BaseMessage[], options?: ChainOptions): AsyncIterable<string>
  }

  class IntentAnalysisStep {
    + name: string
    + execute(context: ChainContext): Promise<void>
  }

  class DirectLLMStep {
    + name: string
    + execute(context: ChainContext): AsyncIterable<string>
  }

  class ReActExecutionStep {
    + name: string
    + execute(context: ChainContext): AsyncIterable<string>
  }

  class ResponseEnhancementStep {
    + name: string
    + execute(context: ChainContext): AsyncIterable<string>
  }

  class PromptReActExecutor {
    - agent: Agent
    + run(messages: BaseMessage[], options?): AsyncIterable<string>
  }

  class FunctionReActExecutor {
    - agent: Agent
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

  class ChatService {
    + runChainStream(messages: BaseMessage[], options): Promise<AsyncIterable<string>>
  }

  class ChatController {
    + streamChatHandler(req: Request, res: Response): Promise<void>
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

  class ChainContext {
    messages: BaseMessage[]
    agent: Agent
    options: ChainOptions
    intentResult?: IntentResult
    reactResults?: string[]
    finalAnswer?: string
  }

  class BaseLanguageModel
  class BaseMessage
  class SystemMessage
  class ChatDeepSeek

  %% 核心关系
  Agent --> ClientManager : uses
  Agent --> BaseLanguageModel : uses
  
  %% 链式处理关系
  AgentChain --> Agent : uses
  AgentChain --> IntentAnalysisStep : contains
  AgentChain --> DirectLLMStep : contains
  AgentChain --> ReActExecutionStep : contains
  AgentChain --> ResponseEnhancementStep : contains
  
  %% 执行器关系
  ReActExecutionStep --> PromptReActExecutor : uses
  ReActExecutionStep --> FunctionReActExecutor : uses
  PromptReActExecutor --> ClientManager : uses
  FunctionReActExecutor --> ClientManager : uses
  PromptReActExecutor --> BaseLanguageModel : uses
  FunctionReActExecutor --> BaseLanguageModel : uses
  
  %% 管理关系
  ClientManager --> MCPHttpClient : manages *
  ClientManager o--> ExternalTool : caches *
  MainServer --> AgentManager : creates
  AgentManager --> Agent : manages *
  Globals --> AgentManager : holds
  
  %% 服务层关系
  MainServer --> ChatDeepSeek : constructs
  MCPServer <.. MainServer : started (test)
  ChatController --> ChatService : uses
  ChatService --> AgentChain : creates
  ChatService --> AgentManager : selects agent
  
  %% 上下文关系
  AgentChain ..> ChainContext : creates
  IntentAnalysisStep ..> ChainContext : uses
  DirectLLMStep ..> ChainContext : uses
  ReActExecutionStep ..> ChainContext : uses
  ResponseEnhancementStep ..> ChainContext : uses
```

### 架构说明

#### 核心组件职责

1. **Agent**: 核心依赖提供者，负责提供LLM、MCP客户端和系统提示词
2. **AgentManager**: 管理多个Agent实例，支持多Agent场景
3. **AgentChain**: 链式处理器，协调各个处理步骤的执行
4. **链式步骤**: 
   - `IntentAnalysisStep`: 意图分析，判断是否需要工具调用
   - `DirectLLMStep`: 直接LLM回答，用于简单问答
   - `ReActExecutionStep`: ReAct执行，处理复杂工具调用
   - `ResponseEnhancementStep`: 响应增强，优化最终输出

#### 处理流程

```
用户请求 → ChatController → ChatService → AgentChain
    ↓
AgentChain.runChain()
    ↓
IntentAnalysisStep (意图分析)
    ↓
分支判断:
├─ 直接回答 → DirectLLMStep → 输出结果
└─ 工具调用 → ReActExecutionStep → ResponseEnhancementStep → 输出结果
```

#### 关键特性

- **模块化设计**: Agent模块可独立打包和部署
- **链式处理**: 支持可扩展的处理步骤
- **多执行策略**: 支持Prompt和Function两种ReAct模式
- **流式输出**: 完整的异步流式处理
- **MCP集成**: 自动发现和调用外部工具

