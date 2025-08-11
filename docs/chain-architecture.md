# 链式处理架构设计文档

## 📋 概述

链式处理架构是本项目的核心设计理念，它将复杂的AI处理流程分解为可组合、可扩展的步骤，每个步骤都有明确的职责和输入输出。

## 🏗️ 设计理念

### 1. 单一职责原则
每个步骤只负责一个特定的功能，如意图分析、直接回答、工具调用或响应增强。

### 2. 可组合性
步骤可以灵活组合，支持不同的处理流程。

### 3. 可扩展性
可以轻松添加新的步骤或修改现有步骤，而不影响其他部分。

### 4. 流式处理
所有步骤都支持流式输出，提供实时的用户体验。

## 🔄 核心组件

### ChainStep 接口

```typescript
interface ChainStep {
  name: string;
  execute(context: ChainContext): Promise<void> | AsyncIterable<string>;
}
```

### ChainContext 上下文

```typescript
interface ChainContext {
  messages: BaseMessage[];           // 用户消息
  agent: Agent;                     // Agent实例
  options: ChainOptions;            // 配置选项
  intentResult?: IntentResult;      // 意图分析结果
  reactResults?: string[];          // ReAct执行结果
  finalAnswer?: string;             // 最终答案
}
```

## 📊 处理步骤详解

### 1. IntentAnalysisStep（意图分析）

**职责**: 分析用户消息，判断是否需要工具调用

**输入**: 用户消息、可用工具列表
**输出**: `{ mode: 'direct' | 'react', reason: string }`

**实现逻辑**:
```typescript
// 构造意图分析提示词
const prompt = `
分析用户消息，判断是否需要使用工具：
- 如果用户询问知识性问题或简单对话，选择 'direct'
- 如果需要获取外部信息、执行操作，选择 'react'

可用工具: ${tools.map(t => t.name).join(', ')}

用户消息: ${userMessage}

请返回JSON格式: { "mode": "direct" | "react", "reason": "分析原因" }
`;
```

**触发条件**: 每次用户请求
**终止条件**: 分析完成，设置 `context.intentResult`

### 2. DirectLLMStep（直接回答）

**职责**: 直接使用LLM生成回答，适用于简单问答

**输入**: 用户消息、系统提示词
**输出**: 流式Markdown格式回答

**实现逻辑**:
```typescript
// 构造直接回答提示词
const messages = [
  new SystemMessage([
    context.agent.systemPromptValue,
    '请直接以 Markdown 格式输出高质量答案。'
  ].join('\n')),
  ...context.messages
];

// 流式输出
const stream = await context.agent.languageModel.stream(messages);
for await (const chunk of stream) {
  yield extractText(chunk.content);
}
```

**触发条件**: `intentResult.mode === 'direct'`
**终止条件**: 回答完成

### 3. ReActExecutionStep（ReAct执行）

**职责**: 执行ReAct推理循环，处理复杂工具调用

**输入**: 用户消息、工具列表、执行策略
**输出**: ReAct执行结果数组

**实现逻辑**:
```typescript
// 根据策略选择执行器
if (strategy === 'function') {
  executor = new FunctionReActExecutor({ agent: context.agent });
} else {
  executor = new PromptReActExecutor({ agent: context.agent });
}

// 执行ReAct循环
for await (const step of executor.run(messages, { maxSteps })) {
  reactResults.push(step);
  if (context.options.reactVerbose) {
    yield step + '\n';
  }
}
```

**触发条件**: `intentResult.mode === 'react'`
**终止条件**: 达到最大步数或得到最终答案

### 4. ResponseEnhancementStep（响应增强）

**职责**: 将ReAct执行结果转换为用户友好的格式

**输入**: ReAct执行结果、原始问题
**输出**: 增强后的Markdown格式回答

**实现逻辑**:
```typescript
// 提取关键信息
const finalAnswer = extractFinalAnswer(reactResults);
const toolCalls = extractToolCalls(reactResults);

// 构造增强提示词
const enhanceMessages = [
  new SystemMessage([
    context.agent.systemPromptValue,
    '你是回复增强器。任务：将ReAct执行结果转换为用户友好的Markdown格式回答。',
    '要求：',
    '- 保持专业性和准确性',
    '- 使用Markdown格式',
    '- 如果涉及工具调用，可以简要提及使用的工具',
    '- 确保回答完整且易于理解'
  ].join('\n')),
  new HumanMessage([
    '原始问题：',
    JSON.stringify(context.messages[context.messages.length - 1]),
    '\n\nReAct执行结果：',
    JSON.stringify({ finalAnswer, toolCalls }),
    '\n\n请输出增强后的Markdown回答：'
  ].join(''))
];

// 流式输出增强结果
const stream = await context.agent.languageModel.stream(enhanceMessages);
for await (const chunk of stream) {
  yield extractText(chunk.content);
}
```

**触发条件**: ReAct执行完成后
**终止条件**: 增强完成

## 🔧 配置选项

### ChainOptions

```typescript
interface ChainOptions {
  maxSteps?: number;                    // ReAct最大执行步数
  strategy?: 'prompt' | 'function';     // 执行策略
  reactVerbose?: boolean;               // 是否输出详细ReAct步骤
  skipIntentAnalysis?: boolean;         // 是否跳过意图分析（预留）
  customSteps?: ChainStep[];            // 自定义步骤（预留）
}
```

## 🎯 扩展机制

### 添加自定义步骤

```typescript
class CustomStep implements ChainStep {
  name = 'custom_step';
  
  async execute(context: ChainContext): Promise<void> {
    // 自定义逻辑
    console.log('执行自定义步骤');
    
    // 可以修改context
    context.customData = 'some data';
  }
}

// 在AgentChain中注册
this.steps.push(new CustomStep());
```

### 修改现有步骤

```typescript
// 继承现有步骤
class EnhancedIntentAnalysisStep extends IntentAnalysisStep {
  async execute(context: ChainContext): Promise<void> {
    // 调用父类方法
    await super.execute(context);
    
    // 添加自定义逻辑
    if (context.intentResult?.mode === 'react') {
      // 额外的处理逻辑
    }
  }
}
```

## 📈 性能优化

### 1. 并行处理
某些步骤可以并行执行，如工具调用和意图分析。

### 2. 缓存机制
可以缓存意图分析结果，避免重复分析。

### 3. 流式处理
所有步骤都支持流式输出，减少延迟。

## 🚨 错误处理

### 1. 步骤失败处理
```typescript
try {
  await step.execute(context);
} catch (error) {
  logger.error(`步骤 ${step.name} 执行失败:`, error);
  // 可以设置默认行为或跳过该步骤
}
```

### 2. 上下文验证
```typescript
// 验证必要的上下文数据
if (!context.intentResult && step.name !== 'intent_analysis') {
  throw new Error('意图分析结果缺失');
}
```

### 3. 超时控制
```typescript
const timeout = setTimeout(() => {
  // 处理超时逻辑
}, 30000);

try {
  await step.execute(context);
} finally {
  clearTimeout(timeout);
}
```

## 🔍 调试与监控

### 1. 步骤执行日志
```typescript
logger.info(`开始执行步骤: ${step.name}`);
const startTime = Date.now();
await step.execute(context);
logger.info(`步骤 ${step.name} 执行完成，耗时: ${Date.now() - startTime}ms`);
```

### 2. 上下文状态监控
```typescript
logger.debug('当前上下文状态:', {
  intentResult: context.intentResult,
  reactResultsCount: context.reactResults?.length,
  hasFinalAnswer: !!context.finalAnswer
});
```

### 3. 性能指标
```typescript
// 记录各步骤的执行时间
const metrics = {
  intentAnalysis: 150,
  directLLM: 2000,
  reactExecution: 5000,
  responseEnhancement: 800
};
```

## 📚 最佳实践

### 1. 步骤设计原则
- 保持步骤职责单一
- 确保步骤可独立测试
- 提供清晰的输入输出接口

### 2. 上下文管理
- 避免在步骤间传递过多数据
- 使用类型安全的上下文接口
- 及时清理不需要的上下文数据

### 3. 错误处理
- 每个步骤都要有适当的错误处理
- 提供有意义的错误信息
- 支持优雅降级

### 4. 性能考虑
- 避免在步骤中执行耗时操作
- 合理使用缓存机制
- 支持流式处理 
