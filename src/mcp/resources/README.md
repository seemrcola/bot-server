# Resource Management (资源管理)

这个目录负责为 MCP Agent 提供一个统一的、可扩展的资源访问层。其核心目标是**将工具的业务逻辑与资源的具体加载方式解耦**。

## 核心组件

*   **`manager.ts` (`ResourceManager`)**: 资源管理器。它是整个系统中访问外部资源的唯一入口。
*   **`providers/`**: 存放了各种**资源提供者 (Provider)**。每个提供者都负责处理一种特定协议的资源请求。
    *   **`file-provider.ts`**: 内置的文件提供者，用于处理 `file://` 协议的 URI，从本地文件系统加载资源。
*   **`types.ts`**: 定义了与资源和提供者相关的 TypeScript 类型。

## 设计理念：提供者模式 (Provider Pattern)

`ResourceManager` 的设计基于强大的**提供者模式**。

1.  **统一接口**: 所有的工具代码都只通过 `mcp.resources.getResource(uri)` 这一个方法来请求资源。
2.  **协议分发**: `ResourceManager` 在接收到请求后，会检查 URI 的协议 (例如 `file://`, `http://` 等)。
3.  **动态选择**: 它会根据协议选择一个已经注册的、能够处理该协议的**提供者 (Provider)**。
4.  **委托执行**: 最后，由选中的提供者负责执行具体的资源加载操作（例如，读取文件内容、发起网络请求等）。

这种设计带来了极大的灵活性。未来可以轻松地添加 `HttpProvider`, `DatabaseProvider` 或 `S3Provider`，而**无需修改任何已有的工具代码**。

## 如何在工具中使用

在你的 `BaseTool` 子类的 `_execute` 方法中，通过 `mcp.resources` 这个统一入口来获取资源。

```typescript
// 在你的工具文件中，例如 src/tools/knowledge.tool.ts

import { BaseTool } from '../../mcp/servers/base-tool.js';
import { mcp } from '../../mcp/index.js'; // 导入 mcp 统一入口
import type { ToolParameters, ToolResult } from '../../mcp/types/index.js';

export class KnowledgeTool extends BaseTool {
  constructor() {
    super('query_knowledge_base', '从本地文件查询知识');
  }

  protected async _execute(params: ToolParameters): Promise<ToolResult> {
    try {
      // 通过 ResourceManager 安全地获取文件内容
      // "file://" 协议确保了 FileProvider 会被使用
      const knowledgeBase = await mcp.resources.getResource('file://data/knowledge_base.txt');
      
      // ... 基于获取到的文件内容执行你的逻辑 ...
      const answer = this.findAnswer(knowledgeBase, params.topic);

      return { success: true, data: answer };
    } catch (error) {
      // 统一处理资源加载失败的情况
      return { success: false, error: '无法加载知识库文件' };
    }
  }

  // ...
}
```

## 如何添加一个新的提供者

1.  **创建提供者类**: 在 `providers/` 目录下创建一个新文件，例如 `http-provider.ts`。
2.  **实现接口**: 让你的类实现 `IResourceProvider` 接口，它需要包含：
    *   一个 `protocol` 属性 (例如 `'http'`)。
    *   一个 `load(uri: string)` 方法，负责发起网络请求并返回内容。
3.  **注册提供者**: 在 `ResourceManager` 的构造函数中，将你的新提供者实例化并添加到 `providers` 映射中。
