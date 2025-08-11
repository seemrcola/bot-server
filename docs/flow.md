## /api/chat/stream 调用流程（链式处理模式）

### 概述
当前系统采用链式处理架构，包含意图分析、分支执行和响应增强三个主要阶段。

### 处理流程

```mermaid
sequenceDiagram
  actor Client as "Client"
  participant Express as "Express App"
  participant Router as "mainRouter/chatRouter"
  participant Controller as "streamChatHandler"
  participant Service as "ChatService"
  participant Chain as "AgentChain"
  participant AM as "AgentManager"
  participant Agent as "Agent"
  participant Intent as "IntentAnalysisStep"
  participant Direct as "DirectLLMStep"
  participant ReAct as "ReActExecutionStep"
  participant Enhance as "ResponseEnhancementStep"
  participant LLM as "LLM (ChatDeepSeek/Any BaseLanguageModel)"
  participant CM as "ClientManager"
  participant MCP as "MCPHttpClient"
  participant Ext as "External MCP Server"

  Client->>Express: POST /api/chat/stream (messages)
  Express->>Router: route matching
  Router->>Controller: streamChatHandler(req, res)
  Controller->>Service: runChainStream(messages, {agentName, strategy, reactVerbose})
  Service->>AM: getAgent(agentName || 'main-agent')
  AM-->>Service: Agent
  Service->>Chain: new AgentChain(agent) & runChain(messages, options)

  Note over Chain: 等待Agent初始化完成
  Chain->>Agent: await agent.ready

  Note over Chain: 阶段1: 意图分析
  Chain->>Intent: execute(context)
  Intent->>LLM: 分析用户意图，判断是否需要工具调用
  LLM-->>Intent: { mode: 'direct' | 'react', reason: string }
  Intent-->>Chain: 设置 context.intentResult

  Note over Chain: 阶段2: 分支执行
  alt 直接回答模式 (mode === 'direct')
    Chain->>Direct: execute(context)
    Direct->>LLM: 直接生成Markdown格式回答
    LLM-->>Direct: 流式输出回答内容
    Direct-->>Chain: yield 回答内容
    Chain-->>Controller: 流式输出最终结果
  else 工具调用模式 (mode === 'react')
    Chain->>ReAct: execute(context)
    
    Note over ReAct: ReAct执行循环
    loop for step in 1..maxSteps
      ReAct->>Agent: 读取 llm/clientManager/systemPrompt
      ReAct->>LLM: invoke(系统提示+ReAct约束+工具清单+历史steps+用户消息)
      LLM-->>ReAct: JSON 决策 {thought, action, action_input}
      
      alt action == tool_call
        ReAct->>CM: callTool(tool_name, parameters)
        CM->>MCP: callTool
        MCP->>Ext: /mcp
        Ext-->>MCP: result
        MCP-->>CM: result
        CM-->>ReAct: result
        ReAct-->>Controller: yield step(含 observation) [如果reactVerbose=true]
      else action == user_input
        ReAct-->>Controller: yield step [如果reactVerbose=true]
        Note right of Controller: 终止等待用户补充
      else action == final_answer
        ReAct-->>Controller: yield step [如果reactVerbose=true]
        Note right of Controller: 终止ReAct循环
      end
    end
    
    Note over Chain: 阶段3: 响应增强
    Chain->>Enhance: execute(context)
    Enhance->>LLM: 将ReAct结果转换为用户友好的Markdown格式
    LLM-->>Enhance: 流式输出增强后的回答
    Enhance-->>Chain: yield 增强后的回答
    Chain-->>Controller: 流式输出最终结果
  end

  Controller-->>Client: res.end()
```

### 关键特性

#### 1. 智能意图分析
- 自动判断用户是否需要工具调用
- 支持直接回答和工具调用两种模式
- 减少不必要的工具调用开销

#### 2. 分支执行策略
- **直接回答**: 适用于知识问答、总结等场景
- **工具调用**: 适用于需要外部数据的复杂任务

#### 3. 响应增强
- 将ReAct执行结果转换为用户友好的格式
- 保持专业性和准确性
- 使用Markdown格式输出

#### 4. 流式处理
- 支持实时流式输出
- 可配置是否显示详细ReAct步骤
- 支持超时和错误处理

### 配置选项

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxSteps` | number | 8 | ReAct最大执行步数 |
| `strategy` | string | 'prompt' | 执行策略：'prompt' 或 'function' |
| `reactVerbose` | boolean | false | 是否输出详细ReAct步骤 |
| `agentName` | string | 'main-agent' | 选择要执行的Agent |

### 错误处理

- **Agent未初始化**: 等待初始化完成
- **Agent不存在**: 返回错误信息
- **工具调用失败**: 记录日志并继续执行
- **LLM调用失败**: 支持策略回退（Function → Prompt）

