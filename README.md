# Bot Server 案例

一个基于链式处理架构的智能Agent服务端项目，实现了"Agent + MCP（Model Context Protocol）+ LangChain"的完整解决方案。

## 🚀 核心特性

- **统一 ReAct 核心**：将传统的“意图分析 → 执行”模式，简化为统一的 `ReAct` 执行循环。模型在循环的第一步即可决定是调用工具还是直接回答。
- **ReAct决策循环**：支持多次 `tool_call` → `observation` → `final_answer`
- **统一Agent编排**：支持1-N个Agent的统一处理，不再区分单多Agent模式
- **MCP外部工具**：自动发现和调用外部MCP工具服务
- **智能网页抓取**：集成完整的网页内容抓取与LLM驱动的智能格式化
- **流式输出**：完整的HTTP文本流输出
- **执行策略**：统一为 Prompt 模式（已移除 Function 模式）
- **响应增强**：自动优化和格式化ReAct结果
- **自管理工具注册**：每个MCP工具管理自己的注册信息，符合单一职责原则

## 🏗️ 架构概览

```
Bot Server/
├── src/
│   ├── agent/                              # Agent核心模块
│   │   ├── chain/                          # 链式处理
│   │   │   ├── agent-chain.ts              # 主链式处理器
│   │   │   ├── types.ts                    # 类型定义
│   │   │   └── steps/                      # 处理步骤
│   │   │       ├── react-execution.ts      # ReAct执行 (统一入口)
│   │   │       └── response-enhancement.ts # 响应增强
│   │   ├── executors/                      # 执行器（底层实现）
│   │   ├── mcp/                            # MCP协议支持
│   │   └── manager.ts                      # Agent管理器 (deprecated)
│   ├── orchestration/                      # Agent编排层
│   │   ├── Dashboard/                      # Dashboard子Agent集合
│   │   │   ├── WebHelper/                  # 网页抓取助手Agent
│   │   │   │   └── webCatcher/             # 智能网页抓取工具集
│   │   │   │       ├── urlValidator        # URL验证工具
│   │   │   │       ├── htmlFetcher         # HTML获取工具
│   │   │   │       ├── contentParser       # 内容解析工具
│   │   │   │       └── resultFormatter     # LLM驱动格式化工具
│   │   │   └── Antfe/                      # Antfe团队助手Agent
│   │   ├── Leader/                         # Leader工具集
│   │   ├── bootstrap.ts                    # 启动编排
│   │   ├── llm.ts                          # LLM工厂
│   │   ├── manager.ts                      # Agent管理器
│   │   └── router.ts                       # 智能路由
│   ├── controllers/                        # 控制器层
│   ├── services/                           # 服务层
│   ├── routes/                             # 路由层
│   ├── middlewares/                        # 中间件
│   ├── utils/                              # 通用工具
│   ├── external/                           # 外部MCP服务示例
│   ├── config/                             # 配置管理
│   └── prompts/                            # 提示词管理
└── docs/                                   # 架构文档
```

## 🎯 快速开始

### 环境准备

```bash
# 克隆项目
git clone <repository-url>
cd bot-server

# 安装依赖
pnpm install

# 设置环境变量
cp .env.example .env
# 编辑 .env 文件，设置你的API密钥
```

### 启动服务

```bash
# 开发模式
pnpm dev

# 生产模式
pnpm build
pnpm start
```

### 测试
public/chat.html 是测试网页。

## 🔄 处理流程

```
用户请求
    ↓
ChatController
    ↓
ChatService.runChainStream()
    ↓
统一Agent编排 (runWithLeader)
    ↓
显式指定 → 智能路由(1-N个Agent) → Leader兜底
    ↓
AgentChain.runChain() × N
    ↓
ReAct执行 (ReActExecutionStep)
    ↓
响应增强 (ResponseEnhancementStep)
    ↓
流式输出
```

## 🛠️ 执行策略

### Prompt 模式
- **适用场景**: 所有支持JSON输出的模型
- **特点**: 通过提示词约束输出ReAct JSON格式
- **优势**: 通用性强，兼容性好
- **劣势**: Token开销略高

## 📚 相关文档

- [ReAct流程](./docs/react-flow.md)
- [A2A 路由/启动流程](./docs/a2a-flow.md)
- [MCP协议文档](https://modelcontextprotocol.io/)
