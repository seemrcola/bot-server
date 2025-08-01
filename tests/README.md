# 测试文档

本项目采用分层测试策略，包含单元测试、集成测试和端到端测试。

## 测试结构

```
tests/
├── unit/           # 单元测试
├── integration/    # 集成测试
├── e2e/           # 端到端测试
├── utils/         # 测试工具
└── README.md      # 本文档
```

## 测试类型

### 🔬 单元测试 (Unit Tests)
- **位置**: `tests/unit/`
- **目的**: 测试单个组件或函数的功能
- **特点**: 快速、独立、使用模拟对象
- **运行**: `npm run test:unit`

**包含的测试**:
- `intent-analyzer.test.ts` - 意图分析器测试
- `task-executor.test.ts` - 任务执行器测试

### 🔗 集成测试 (Integration Tests)
- **位置**: `tests/integration/`
- **目的**: 测试多个组件协作的功能
- **特点**: 测试真实的组件交互
- **运行**: `npm run test:integration`

**包含的测试**:
- `mcp-agent.test.ts` - MCP Agent完整流程测试

### 🌐 端到端测试 (E2E Tests)
- **位置**: `tests/e2e/`
- **目的**: 测试完整的用户场景
- **特点**: 测试真实的API调用和响应
- **运行**: `npm run test:e2e`

**包含的测试**:
- `api.test.ts` - HTTP API端到端测试

## 运行测试

### 运行所有测试
```bash
npm test
```

### 运行特定类型的测试
```bash
# 单元测试
npm run test:unit

# 集成测试
npm run test:integration

# 端到端测试
npm run test:e2e
```

### 监视模式
```bash
npm run test:watch
```

### 生成覆盖率报告
```bash
npm run test:coverage
```

## 测试工具

### 测试辅助函数
`tests/utils/test-helpers.ts` 提供了通用的测试工具：

- `createTestMCPAgent()` - 创建测试用的MCP Agent
- `createMockLLMResponse()` - 创建模拟的LLM响应
- `TEST_CASES` - 预定义的测试用例
- `checkResponseQuality()` - 检查响应质量
- `validateIntentAnalysisResult()` - 验证意图分析结果

### 测试数据
测试使用预定义的测试用例，包括：
- 简单对话场景
- 工具调用场景
- 混合任务场景

## 测试最佳实践

### 1. 测试命名
- 使用描述性的测试名称
- 使用中文描述测试意图
- 格式：`应该 + 期望行为`

### 2. 测试结构
- 使用 `describe` 分组相关测试
- 使用 `beforeEach` 和 `afterEach` 进行设置和清理
- 每个测试应该独立且可重复

### 3. 断言
- 使用具体的断言而不是通用的
- 验证关键的业务逻辑
- 包含边界条件测试

### 4. 模拟对象
- 只模拟外部依赖
- 保持模拟对象简单
- 验证模拟对象的调用

## 环境配置

### 环境变量
测试需要以下环境变量：
```bash
# LLM配置（可选，测试会使用模拟值）
LLM_API_KEY=your-api-key
LLM_MODEL=deepseek-chat
LLM_BASE_URL=https://api.deepseek.com

# E2E测试配置
TEST_API_URL=http://localhost:3000
```

### 测试数据库
集成测试和E2E测试可能需要测试数据库或服务器。确保：
- 使用独立的测试环境
- 测试后清理数据
- 不影响生产数据

## 持续集成

### GitHub Actions
项目配置了GitHub Actions来自动运行测试：
1. 单元测试 - 每次提交都运行
2. 集成测试 - PR时运行
3. E2E测试 - 发布前运行

### 测试覆盖率
- 目标覆盖率：80%以上
- 关键业务逻辑：90%以上
- 覆盖率报告会自动生成

## 故障排除

### 常见问题

1. **测试超时**
   - 检查网络连接
   - 增加超时时间
   - 检查异步操作

2. **模拟对象失效**
   - 确保在每个测试后重置模拟
   - 检查模拟对象的配置

3. **环境依赖**
   - 确保测试环境配置正确
   - 检查必要的服务是否运行

### 调试测试
```bash
# 运行单个测试文件
npx vitest run tests/unit/intent-analyzer.test.ts

# 调试模式
npx vitest --inspect-brk tests/unit/intent-analyzer.test.ts
```

## 贡献指南

### 添加新测试
1. 确定测试类型（单元/集成/E2E）
2. 使用现有的测试工具和模式
3. 添加适当的文档和注释
4. 确保测试通过且覆盖率满足要求

### 测试审查
- 测试应该清晰易懂
- 覆盖主要的使用场景
- 包含错误处理测试
- 性能测试（如适用）

---

更多信息请参考项目的主要文档和代码注释。
