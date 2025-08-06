# MCP Servers 模块

`servers` 模块是 MCP 框架中与“工具端”服务相关的所有组件的集合。它定义了工具的标准化结构，并提供了管理工具服务器生命周期的机制。

## 模块结构与职责

```
servers/
├── manager.ts        # 服务器管理器，负责注册、启动和停止所有的 MCP 服务器实例
├── base-tool.ts      # 所有工具的抽象基类，提供了标准化的接口和通用功能
└── tool-registry.ts  # 工具注册表，用于在单个服务器实例中管理可用的工具
```

### 1. `manager.ts`

`ServerManager` 是一个单例（Singleton），作为整个应用中所有工具服务器（`IMCPServer` 的实现）的中心化管理器。它的核心职责是：

-   **生命周期管理**: 提供了 `registerAndStartServers` 和 `stopAllServers` 方法，用于批量启动和停止在应用中定义的所有 MCP 服务器。这确保了服务器能够随应用启动而启动，随应用关闭而有序关闭。
-   **服务器注册与访问**: 维护一个 `Map` 来存储所有已注册的服务器实例，并允许通过名称 (`getServer`) 或批量 (`getAllServers`) 的方式来访问它们。
-   **工具注册代理**: 提供了 `registerTool` 方法，允许 `MCPAgent` 将一个工具动态注册到指定的服务器实例上。它起到了一个将注册请求路由到正确服务器实例的代理作用。

### 2. `base-tool.ts`

`BaseTool` 是一个抽象类，它实现了 `ITool` 接口。它是创建具体工具的推荐基类，因为它提供了许多开箱即用的功能：

-   **标准化结构**: 定义了所有工具都应具备的核心属性，如 `name`, `description`, 和 `parameters`。`parameters` 遵循类似 JSON Schema 的格式，用于描述工具的输入参数。
-   **执行逻辑封装**: `execute` 方法封装了工具执行的通用逻辑，包括日志记录、性能计时和统一的错误处理。开发者在继承 `BaseTool` 时，只需要实现核心的 `_execute` 抽象方法，专注于业务逻辑即可。
-   **参数验证**: 提供了一个 `validateParameters` 的辅助方法，可以根据 `parameters` 中定义的 schema 自动检查传入参数的完整性和基本类型，减少了重复的校验代码。
-   **结果格式化**: 提供了 `createSuccessResult` 和 `createErrorResult` 辅助方法，用于生成标准化的 `ToolResult` 对象。

### 3. `tool-registry.ts`

`ToolRegistry` 是一个用于在单个服务器实例内部管理工具集合的类。每个 `IMCPServer` 的实现（例如 `DefaultMCPServer`）通常会拥有一个 `ToolRegistry` 实例。

-   **工具管理**: 提供了 `registerTool`, `unregisterTool`, `getTool` 等方法，用于动态地添加、移除和查询服务器上的工具。
-   **信息查询**: `getAllTools` 方法可以返回该服务器上所有已注册工具的详细信息（`ToolInfo`），这对于服务发现和客户端查询可用功能至关重要。
-   **使用统计**: 内部记录了每个工具被调用的次数和最后使用时间，为未来的工具使用分析、性能监控或实现“最常用工具”等功能提供了数据基础。

## 协作流程

1.  在应用启动时（例如，在 `src/index.ts` 中），会创建具体的 `IMCPServer` 实例（如 `DefaultMCPServer`）。
2.  这些服务器实例被包装成 `ServerRegistration` 对象，并传递给 `ServerManager`。
3.  `MCPAgent` 在初始化时，会调用 `ServerManager.getInstance().registerAndStartServers()` 来启动所有这些服务器。
4.  每个具体的工具（例如 `JoJoTool`）都继承自 `BaseTool`，实现了自己的 `_execute` 方法。
5.  在应用启动后，`MCPAgent` 通过调用 `ServerManager` 的 `registerTool` 方法，将这些工具实例注册到对应的 `IMCPServer` 上。
6.  在服务器内部，`IMCPServer` 使用其 `ToolRegistry` 实例来存储和管理这些注册的工具。
7.  当 `MCPAgent` 需要执行一个工具时，它会向相应的 `IMCPServer` 发送请求。服务器收到请求后，会从其 `ToolRegistry` 中查找并执行该工具。
