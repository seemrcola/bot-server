# Prompt Management (提示词管理)

这个目录下的文件定义了 MCP Agent 在执行任务时所使用的核心系统提示词 (System Prompts)。

## 核心组件

*   **`manager.ts` (`PromptManager`)**: 提示词管理器。它是 Agent 获取所有提示词的唯一来源。它负责加载默认提示词，并允许通过外部配置进行覆盖。
*   **`default.ts`**: 包含了所有内置的默认提示词。这些是 Agent 在没有提供任何自定义配置时的“出厂设置”。
*   **`types.ts`**: 定义了与提示词相关的 TypeScript 类型。

## 工作原理

`PromptManager` 的设计核心是**灵活性**和**可配置性**。

1.  **加载默认值**: 在 `MCPService` 启动时，`PromptManager` 会首先加载 `default.ts` 中定义的所有默认提示词。
2.  **接收覆盖**: `mcp.service.start(config)` 方法接受一个可选的 `config` 对象。如果这个对象中包含了 `prompts` 字段，`PromptManager` 会将这些自定义的提示词合并进来，覆盖掉同名的默认值。
3.  **提供访问**: Agent 的核心逻辑（如意图分析、最终响应生成）从不硬编码任何提示文本。相反，它总是通过 `PromptManager.getPrompt(key)` 的方式来获取当前有效的提示词。

这种机制确保了 Agent 的行为可以在不修改 `mcp` 模块内部代码的情况下，被外部应用轻松定制。

## 如何自定义提示词

要自定义 Agent 的提示词，你需要在启动 `mcp` 服务时传入一个配置对象。

```typescript
// 在你的应用主入口，如 src/index.ts

import { mcp } from '../../mcp/index.js';

// 1. 定义你的自定义配置
const myCustomConfig: Partial<mcp.types.MCPAgentConfig> = {
  // ... 其他配置
  prompts: {
    // 覆盖意图分析的提示
    intent_analysis: "你是一个世界级的任务规划专家。请将用户的请求分解为清晰、可执行的步骤。",
    
    // 覆盖默认问候语
    simple_task: "您好，我是您的专属AI助理，随时为您服务。"
  }
};

// 2. 在启动时传入配置
// (serverRegistrations 是你定义的服务器列表)
await mcp.service.start(myCustomConfig, serverRegistrations);
```

## 可覆盖的提示词

目前，你可以覆盖以下几个核心提示词：

*   `intent_analysis`: 用于指导 LLM 进行任务分解和意图分析。
*   `simple_task`: 当没有检测到工具调用意图时，用于生成简单回复的提示。
*   `final_response`: 在所有工具执行完毕后，用于生成最终总结性回复的提示。
*   `tool_error`: 当工具执行失败时，用于生成错误反馈的提示。
