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
│   │   ├── chain/                          # 链式处理引擎
│   │   │   ├── executors/                  # ReAct执行器 (底层实现)
│   │   │   ├── steps/                      # 链式处理步骤 (ReAct, 响应增强等)
│   │   │   ├── prompts/                    # LangChain提示词模板
│   │   │   └── agent-chain.ts              # 主链式处理器
│   │   ├── mcp/                            # MCP协议 (客户端/服务端)
│   │   └── agent.ts                        # Agent核心类定义
│   ├── orchestration/                      # Agent编排层
│   │   ├── Dashboard/                      # Dashboard子Agent集合
│   │   │   └── WebHelper/                  # 网页抓取助手Agent
│   │   ├── Leader/                         # Leader Agent (路由/兜底)
│   │   ├── bootstrap.ts                    # 服务启动与Agent注册
│   │   ├── llm.ts                          # LLM模型工厂
│   │   ├── manager.ts                      # Agent管理器
│   │   └── router.ts                       # 智能路由选择
│   ├── controllers/                        # 控制器层 (HTTP API)
│   ├── services/                           # 业务服务层
│   ├── routes/                             # Express路由定义
│   ├── middlewares/                        # Express中间件
│   ├── utils/                              # 通用工具函数
│   └── config/                             # 应用配置
├── docs/                                   # 架构与流程文档
├── public/                                 # 静态资源 (测试前端页面)
└── package.json                            # 项目依赖与脚本
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
