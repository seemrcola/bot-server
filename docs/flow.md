# MCP 混合处理架构流程图

## 系统架构概览

```mermaid
graph TB
    %% 样式定义
    classDef userLayer fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
    classDef serviceLayer fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef coreLayer fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef toolLayer fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef llmLayer fill:#fce4ec,stroke:#c2185b,stroke-width:2px

    %% 用户层
    subgraph USER ["👤 用户层"]
        U1[用户输入消息]
        U2[接收最终响应]
    end

    %% 服务层
    subgraph SERVICE ["🌐 服务层"]
        S1[Chat Controller]
        S2[HTTP/WebSocket 接口]
    end

    %% MCP核心层
    subgraph CORE ["🧠 MCP 核心处理层"]
        C1[MCP Agent<br/>总控制器]
        C2[Intent Analyzer<br/>意图分析]
        C3[Task Executor<br/>任务执行]
        C4[MCP Client<br/>工具客户端]
    end

    %% 工具层
    subgraph TOOLS ["🛠️ 工具执行层"]
        T1[MCP Server<br/>工具服务器]
        T2[JoJo Tool]
        T3[Weather Tool]
        T4[Other Tools]
    end

    %% LLM层
    subgraph LLM ["🤖 LLM 处理层"]
        L1[LLM Processor<br/>文本处理]
        L2[System Prompts<br/>提示词管理]
        L3[DeepSeek API<br/>外部LLM]
    end

    %% 主流程连接
    U1 --> S1
    S1 --> C1
    C1 --> C2
    C2 --> L1
    L1 --> L3
    L3 --> L1
    L1 --> C2
    C2 --> C1
    C1 --> C3
    C3 --> C4
    C4 --> T1
    T1 --> T2
    T1 --> T3
    T1 --> T4
    T2 --> T1
    T3 --> T1
    T4 --> T1
    T1 --> C4
    C4 --> C3
    C3 --> L1
    L1 --> C3
    C3 --> C1
    C1 --> S1
    S1 --> U2

    %% 辅助连接
    L2 -.-> C2
    L2 -.-> C3

    %% 应用样式
    U1:::userLayer
    U2:::userLayer
    S1:::serviceLayer
    S2:::serviceLayer
    C1:::coreLayer
    C2:::coreLayer
    C3:::coreLayer
    C4:::coreLayer
    T1:::toolLayer
    T2:::toolLayer
    T3:::toolLayer
    T4:::toolLayer
    L1:::llmLayer
    L2:::llmLayer
    L3:::llmLayer
```

## 详细处理流程

```mermaid
sequenceDiagram
    participant User as 👤 用户
    participant Chat as 🌐 Chat Service
    participant Agent as 🧠 MCP Agent
    participant Analyzer as 🔍 Intent Analyzer
    participant Executor as ⚡ Task Executor
    participant LLM as 🤖 LLM Processor
    participant Client as 📡 MCP Client
    participant Server as 🖥️ MCP Server
    participant Tool as 🎭 JoJo Tool

    Note over User,Tool: 混合处理完整流程

    %% 阶段1: 请求接收
    rect rgb(225, 245, 254)
        Note over User,Chat: 阶段1: 请求接收
        User->>Chat: 1. 发送消息 "jojo"
        Chat->>Agent: 2. 转发用户消息
    end

    %% 阶段2: 意图分析
    rect rgb(232, 245, 233)
        Note over Agent,LLM: 阶段2: 意图分析
        Agent->>Analyzer: 3. 分析用户意图
        Analyzer->>LLM: 4. 调用LLM分析
        LLM->>LLM: 5. 使用系统提示词
        LLM-->>Analyzer: 6. 返回分析结果
        Analyzer->>Analyzer: 7. 解析为子任务
        Analyzer-->>Agent: 8. 返回任务列表
    end

    %% 阶段3: 任务执行
    rect rgb(255, 243, 224)
        Note over Agent,Tool: 阶段3: 任务执行
        Agent->>Executor: 9. 执行任务
        
        alt 工具任务
            Executor->>Client: 10. 调用工具
            Client->>Server: 11. WebSocket请求
            Server->>Tool: 12. 路由到JoJo工具
            Tool-->>Server: 13. 返回 "ゴゴゴゴゴ..."
            Server-->>Client: 14. 工具响应
            Client-->>Executor: 15. 返回工具结果
        else 简单任务
            Executor->>LLM: 10. 直接LLM处理
            LLM-->>Executor: 11. 返回文本结果
        end
    end

    %% 阶段4: 响应生成
    rect rgb(252, 228, 236)
        Note over Executor,User: 阶段4: 响应生成
        Executor->>LLM: 16. 生成最终响应
        LLM-->>Executor: 17. 返回友好回复
        Executor-->>Agent: 18. 任务执行完成
        Agent-->>Chat: 19. 返回处理结果
        Chat-->>User: 20. 发送最终响应
    end
```

## 核心组件职责

### 🧠 MCP Agent (总控制器)
- 协调整个处理流程
- 管理组件间通信
- 处理错误和降级

### 🔍 Intent Analyzer (意图分析器)
- 分析用户消息意图
- 分解复杂请求为子任务
- 确定任务类型和优先级

### ⚡ Task Executor (任务执行器)
- 执行不同类型的任务
- 支持并行和串行执行
- 整合多个任务结果

### 🤖 LLM Processor (LLM处理器)
- 与外部LLM API交互
- 管理提示词模板
- 处理文本生成和解析

### 📡 MCP Client (工具客户端)
- 与工具服务器通信
- 管理WebSocket连接
- 处理工具调用请求

### 🖥️ MCP Server (工具服务器)
- 管理工具注册和路由
- 处理工具调用请求
- 返回工具执行结果

## 任务类型处理

```mermaid
flowchart LR
    subgraph TASK_TYPES ["任务类型分类"]
        A[用户消息] --> B{意图分析}
        B -->|简单对话| C[Simple Chat<br/>直接LLM处理]
        B -->|工具调用| D[Tool Call<br/>调用具体工具]
        B -->|混合任务| E[Hybrid<br/>组合处理]
    end

    subgraph EXECUTION ["执行策略"]
        C --> F[LLM Processor]
        D --> G[MCP Client → Tools]
        E --> H[智能路由<br/>并行/串行执行]
    end

    subgraph RESULT ["结果整合"]
        F --> I[最终响应生成]
        G --> I
        H --> I
        I --> J[用户友好回复]
    end

    classDef taskType fill:#e3f2fd,stroke:#1976d2
    classDef execution fill:#f1f8e9,stroke:#388e3c
    classDef result fill:#fce4ec,stroke:#c2185b

    A:::taskType
    B:::taskType
    C:::taskType
    D:::taskType
    E:::taskType
    F:::execution
    G:::execution
    H:::execution
    I:::result
    J:::result
```

## 关键特性

### ✨ 智能意图识别
- 自动识别用户真实意图
- 支持复杂多步骤请求
- 上下文感知分析

### 🔄 混合处理模式
- 简单对话直接LLM处理
- 工具调用自动路由
- 混合任务智能分解

### 🛠️ 可扩展工具系统
- 标准化工具接口
- 动态工具注册
- WebSocket实时通信

### 📝 集中化提示词管理
- 模板化提示词
- 多语言支持
- 易于维护和更新

## 数据流示例

### JoJo工具调用示例
```
用户输入: "jojo"
↓
意图分析: 识别为工具调用任务
↓
任务执行: 调用JoJo工具
↓
工具响应: "ゴゴゴゴゴ..."
↓
最终回复: "ロードローラーだ！(ROAD ROLLER DA!) —— 看来你提到《JoJo的奇妙冒险》了呢！..."
```

### 混合任务示例
```
用户输入: "你好，请调用jojo工具"
↓
意图分析: 识别为混合任务 (问候 + 工具调用)
↓
任务分解: [简单对话任务, 工具调用任务]
↓
并行执行: 生成问候回复 + 调用JoJo工具
↓
结果整合: 合并两个任务的结果
↓
最终回复: 友好的问候 + JoJo相关内容
```
