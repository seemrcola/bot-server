# LLM (Large Language Model) 模块

`llm` 模块是 MCP 框架的认知核心，封装了与大语言模型交互的所有逻辑。它提供了一个标准化的接口，用于发送请求、处理响应以及管理不同 LLM 服务（如 DeepSeek, Anthropic 等）的复杂性。

## 模块结构与职责

```
llm/
├── service.ts      # LLM 服务层，负责实际的 API 调用、错误处理和指标收集
├── processor.ts    # NLP 处理器，构建在服务层之上，提供更高阶的 NLP 功能
├── errors.ts       # 定义了与 LLM 相关的自定义错误类型
└── index.ts        # 模块的统一入口，导出所有公共类、类型和配置
```

### 1. `service.ts`

这是与 LLM API 直接交互的底层服务。它的主要职责是：

-   **API 调用**: 实现了一个统一的 `callOpenAICompatible` 方法，用于向任何兼容 OpenAI API 格式的 LLM 服务（例如 DeepSeek）发送请求。这使得切换不同的 LLM 后端变得非常容易。
-   **配置管理**: 从全局 `configManager` 获取 LLM 配置（如 API Key, Base URL, Model Name 等）。
-   **错误处理**: 捕获 API 调用过程中的各种错误（如网络超时、认证失败、速率限制），并将它们转换为特定类型的自定义错误（定义在 `errors.ts` 中），方便上层模块进行精细化的错误处理。
-   **健康与指标监控**: 收集请求成功率、平均响应时间等关键指标 (`LLMMetrics`)，并提供 `isHealthy()` 方法来判断服务的健康状况。

### 2. `processor.ts`

`LLMNLPProcessor` (自然语言处理处理器) 是构建在 `LLMService` 之上的一个更高层次的抽象。它不直接进行 API 调用，而是利用 `LLMService` 提供的能力来完成更复杂的 NLP 任务。它是 `MCPAgent` 直接交互的对象。

-   **功能封装**: 提供了多个面向特定任务的方法：
    -   `analyzeMessage`: 分析用户消息，判断其意图是否需要调用工具。
    -   `extractParameters`: 当确定需要调用工具时，进一步从用户消息中提取该工具所需的参数。
    -   `generateText`: 在 ReAct 模式下，用于生成“思考”步骤或最终回复的文本。
-   **提示词工程 (Prompt Engineering)**: 内部包含了构建各种复杂提示词（Prompt）的逻辑，例如，在 `buildAnalysisPrompt` 中，它会将可用的工具列表和用户消息组合成一个结构化的提示，以引导 LLM 做出准确的判断。
-   **响应解析**: 负责解析 LLM 返回的（通常是 JSON 格式的）原始字符串，并将其转换为结构化的数据对象（如 `AnalysisResult`）。

### 3. `errors.ts`

该文件定义了一系列继承自 `LLMServiceError` 的自定义错误类。这种设计的好处是：

-   **明确错误类型**: 使得调用方可以通过 `instanceof` 来判断错误的具体类型，从而执行不同的处理逻辑（例如，对于 `LLMRateLimitError` 可以进行重试，而对于 `LLMAuthenticationError` 则应直接失败并告警）。
-   **集中管理**: 将所有与 LLM 相关的错误定义集中在一个地方，便于维护和查阅。

### 4. `index.ts`

这是 `llm` 模块的公共 API。它统一导出了模块内所有需要被外部使用的类、类型定义、错误和默认配置。

-   **简化导入**: 其他模块（如 `agent`）只需要从 `mcp/llm` 这一个路径导入所有需要的东西，而无需关心其内部文件结构，实现了良好的封装。
-   **定义公共契约**: `index.ts` 中导出的内容构成了该模块与外部世界之间的“契约”，明确了模块提供了哪些功能和数据结构。

## 协作流程

1.  `MCPAgent` 需要分析用户意图时，会实例化一个 `LLMNLPProcessor`。
2.  `LLMNLPProcessor` 的 `analyzeMessage` 方法被调用。
3.  `LLMNLPProcessor` 内部构建一个复杂的提示词，然后调用 `LLMService` 的 `generateCompletion` 方法。
4.  `LLMService` 负责向配置好的 LLM API 端点（如 DeepSeek）发送 HTTP 请求。
5.  `LLMService` 接收到 API 响应，进行基础的错误处理后，将原始文本返回给 `LLMNLPProcessor`。
6.  `LLMNLPProcessor` 解析收到的文本，提取出结构化的意图和实体信息，最终返回给 `MCPAgent`。
