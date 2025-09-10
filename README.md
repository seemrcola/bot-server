# Bot Server 案例

一个基于链式处理架构的智能Agent服务端项目，实现了"Agent + MCP（Model Context Protocol）+ LangChain"的完整解决方案。

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
后续会有一个playground项目与这个服务做完整对接。

暂时可以使用我的另一个仓库 bot-app 来做对话测试。

目前支持的工具写在了 `src/_orchestration/Dashboard/*` 下。

🔄 处理流程

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

## 简单教程

[简单教程](./TEACH.md)
