# MCP Agent 模块

`agent` 模块是 MCP（模型-上下文-协议）框架的核心协调器。它实现了类似 ReAct (Reason+Act) 的模式，负责理解用户意图、规划任务、执行工具并最终生成回复。

## 模块结构与职责

```
agent/
├── mcp-agent.ts          # Agent 的核心实现，负责整个生命周期和工作流编排
├── intent-analyzer.ts    # 意图分析器，将用户输入分解为子任务
├── task-executor.ts      # 任务执行器，执行具体的子任务（如调用工具、生成文本）
├── message-processor.ts  # 消息处理器，定义和处理 MCP 通信协议的消息格式
└── system-prompts.ts     # 系统提示词，管理所有与 LLM 交互的模板化提示
```

### 1. `mcp-agent.ts`

这是 Agent 的主入口和核心控制器。它负责：

-   **生命周期管理**: 初始化 (`initialize`)、关闭 (`shutdown`) 和状态管理。
-   **服务与客户端协调**: 管理 `ServerManager`，并为每个工具服务器创建 `MCPClient` 实例，建立通信。
-   **工作流编排**: 接收外部消息，调用 `IntentAnalyzer` 进行意图分析，然后将分析结果交给 `TaskExecutor` 执行，最后整合结果。
-   **消息处理**: 提供流式 (`processMessageStream`) 和一次性 (`processMessage`) 两种处理模式。
-   **连接处理**: 具备处理外部 WebSocket 连接 (`handleConnection`) 的能力，使得其他服务可以通过标准 MCP 协议与其交互。

### 2. `intent-analyzer.ts`

该文件负责“思考”阶段。它接收用户原始消息，并借助 LLM 将其分解成一个或多个结构化的子任务。

-   **意图识别**: 通过精心设计的系统提示词 (`system-prompts.ts`)，引导 LLM 分析用户输入。
-   **任务分解**: 将复杂请求分解为更小的、可执行的步骤（`SubTask`），例如简单聊天或工具调用。
-   **任务类型判断**: 确定每个子任务的类型 (`TaskType`)、是否需要工具 (`needsTool`) 以及建议使用的工具 (`suggestedTools`)。
-   **结果优化**: 对 LLM 返回的结果进行验证和优化，例如，当置信度过低时，会降级为简单的聊天任务。

### 3. `task-executor.ts`

该文件负责“行动”阶段。它接收 `IntentAnalyzer` 生成的子任务列表，并按计划执行它们。

-   **任务调度**: 根据任务间的依赖关系 (`dependencies`) 和优先级 (`priority`) 对任务进行排序和分组。
-   **任务执行**:
    -   对于**工具调用任务** (`TOOL_CALL`)，它会通过对应的 `MCPClient` 调用远程工具。
    -   对于**简单聊天任务** (`SIMPLE_CHAT`)，它会调用 LLM 生成文本回复。
    -   对于**混合任务** (`HYBRID`)，它会结合以上两种方式。
-   **结果整合**: 将所有子任务的执行结果（成功或失败）收集起来，并调用 LLM 生成一个连贯、完整的最终回复。
-   **并行与缓存**: 支持任务的并行执行和结果缓存，以提高效率。

### 4. `message-processor.ts`

这是一个静态工具类，定义了 MCP 的消息结构和类型。它确保了 Agent 和 Tool Server 之间的通信是标准化的。

-   **消息定义**: 定义了 `MCPMessage` 接口和 `MCPMessageType` 枚举，涵盖了从工具调用到心跳检测的各种消息类型。
-   **消息创建**: 提供了一系列静态方法（如 `createToolCallMessage`, `createErrorMessage`）来创建格式正确的 JSON 消息。
-   **消息解析与验证**: 提供了 `parseMessage` 和 `validateMessage` 方法，用于解析和验证收到的消息是否符合协议规范。

### 5. `system-prompts.ts`

此文件集中管理了所有用于指导 LLM 的系统提示词模板。将提示词与业务逻辑分离，使得维护和迭代更加方便。

-   **提示词模板**: 包含用于意图分析、简单任务执行、最终回复生成等不同场景的提示词模板。
-   **动态生成**: 提供了多个函数（如 `getIntentAnalysisPrompt`），这些函数接收动态数据（如用户消息、可用工具列表）并生成最终的提示词，供 `IntentAnalyzer` 和 `TaskExecutor` 使用。

## 核心工作流

1.  **启动**: `MCPAgent` 在 `initialize` 阶段启动所有工具服务器 (`IMCPServer`)，并为每个服务器创建一个 `MCPClient` 进行连接。
2.  **接收请求**: `MCPAgent` 的 `processMessage` 或 `processMessageStream` 方法接收到用户消息。
3.  **意图分析**: `MCPAgent` 调用 `IntentAnalyzer`，后者使用 LLM 将消息分解为一系列子任务。
4.  **任务执行**: `MCPAgent` 将子任务列表传递给 `TaskExecutor`。
5.  **调度与执行**: `TaskExecutor` 对任务排序，然后并行或串行地执行它们。
    -   如果任务需要调用工具，`TaskExecutor` 会通过 `MCPClient` 发送一个 `TOOL_CALL` 类型的 `MCPMessage`。
    -   如果任务是简单聊天，`TaskExecutor` 会调用 LLM。
6.  **结果返回**: 工具服务器执行完毕后，返回一个 `TOOL_RESULT` 类型的 `MCPMessage`。
7.  **生成最终回复**: `TaskExecutor` 收集所有任务结果，并再次调用 LLM 将这些零散的结果整合成一段通顺的最终回复。
8.  **发送回复**: `MCPAgent` 将最终回复返回给调用方。
