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

## 如何添加并注入一个新的提供者

得益于依赖注入，为 MCP 添加新的资源处理能力变得非常简单，并且**完全无需修改 `mcp` 模块的内部代码**。

**第一步：在应用层创建你的提供者**

在你的项目中的任何位置（例如 `src/resource-providers/`）创建新的提供者文件。

```typescript
// src/resource-providers/http-provider.ts

import { IResourceProvider, ResourceURI } from '../mcp/types/index.js';
import fetch from 'node-fetch';

export class HttpProvider implements IResourceProvider {
  
  public canHandle(uri: ResourceURI): boolean {
    return uri.startsWith('http://') || uri.startsWith('https://');
  }

  public async load(uri: ResourceURI): Promise<string> {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch resource from ${uri}: ${response.statusText}`);
    }
    return response.text();
  }
}
```

**第二步：在主入口注入你的提供者**

打开你的应用主入口文件（例如 `src/index.ts`），在启动 `mcp` 服务时，将你的新提供者实例传入。

```typescript
// src/index.ts

import { mcp } from './mcp/index.js';
import { FileProvider } from './mcp/resources/providers/file-provider.js';
import { HttpProvider } from './resource-providers/http-provider.js'; // 导入你的新提供者

async function startServer() {
  // ... 其他代码 ...

  // 准备要注入的资源提供者列表
  const resourceProviders = [
    new FileProvider(), // 注入内置的文件提供者
    new HttpProvider(), // 注入你的自定义 HTTP 提供者
  ];

  // 在启动 MCP 服务时，将服务器列表和资源提供者列表一并传入
  await mcp.service.start(
    undefined, 
    serverRegistrations, // 你的服务器列表
    resourceProviders    // 你的资源提供者列表
  );

  // ... 启动你的 Express 应用 ...
}

startServer();
```

**完成！**

现在，你在任何工具中调用 `mcp.resources.getResource('https://...')` 时，`ResourceManager` 都会自动使用你刚刚注入的 `HttpProvider` 来处理该请求。系统实现了完全的解耦和高可扩展性。
