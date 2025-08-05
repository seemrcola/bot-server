# Bot Server - AI 聊天机器人后端服务

前端仓库是我的仓库下的 bot-app 项目。  


这是一个基于 Node.js 和 TypeScript 构建的、功能强大的 AI 聊天机器人后端服务。它不仅能进行常规的语言对话，更通过内置的 **MCP (Model-Context-Protocol)** 模块，赋予了 AI Agent 调用外部工具的能力，使其能够完成更复杂的任务。

## ✨ 核心特性

- **先进的 Agent 架构**: 内置 MCP 模块，基于 **ReAct (Reasoning and Acting)** 设计模式，让 AI 能够思考、行动、观察，并调用工具。
- **灵活的工具扩展**: 基于**依赖注入**和**控制反转 (IoC)**，可以轻松地在应用层定义和注册新的工具与服务，并注入到 `mcp` 模块中，实现了真正的解耦。
- **流式响应**: API 端点完全支持流式输出，提供流畅的实时聊天体验。
- **分层与解耦**:清晰的项目结构 (`Route` -> `Controller` -> `Service`)，以及高度内聚的 `mcp` 模块，易于维护和扩展。
- **现代化 TypeScript**: 完全基于 TypeScript 和 ES Modules，提供强大的类型安全和现代化的开发体验。

## 🛠️ 技术栈

- **后端**: Node.js, Express
- **语言**: TypeScript
- **核心 AI**: LangChain.js
- **Agent 框架**: 自研的 MCP (Model-Context-Protocol)
- **开发工具**: ESLint (代码规范), `tsx` (TypeScript 实时执行)

## 🚀 快速开始

### 1. 环境要求

- Node.js (版本 `>=18.0.0`)
- pnpm (推荐) 或 npm/yarn

### 2. 安装依赖

克隆项目后，在根目录下执行：

```bash
pnpm install
# 或者
npm install
```

### 3. 配置环境变量

在项目根目录下创建一个 `.env` 文件，并填入必要的配置。这是启动服务的关键。

```env
# .env 文件示例

# 你的语言模型 API Key (必需)
LLM_API_KEY="your_deepseek_or_openai_api_key"

# (可选) 你的语言模型 API 地址
LLM_BASE_URL="https://api.deepseek.com/v1"

# (可选) 你想使用的语言模型名称
LLM_MODEL="deepseek-chat"
```

### 4. 启动服务

**开发模式** (带热重载):

```bash
pnpm dev
```

**生产模式**:

```bash
# 1. 编译 TypeScript
pnpm build

# 2. 启动服务
pnpm start
```

服务启动后，默认监听在 `http://localhost:3000` (端口可在 `src/config/index.ts` 中修改)。

## 📜 可用的 NPM 脚本

- `pnpm dev`: 以开发模式启动服务，文件变更时自动重启。
- `pnpm build`: 将 TypeScript 编译为 JavaScript 到 `dist` 目录。
- `pnpm start`: 运行编译后的生产环境代码。
- `pnpm lint`: 检查代码风格。

## 📂 项目结构

```
.
├── src/
│   ├── config/         # 应用全局配置
│   ├── controllers/    # Express 控制器，处理HTTP请求
│   ├── middlewares/    # Express 中间件
│   ├── mcp/            # 核心的 MCP Agent 模块 (可独立)
│   ├── routes/         # API 路由定义
│   ├── services/       # 业务逻辑服务层
│   ├── servers/        # [新增] 应用层的 MCP 服务器定义
│   ├── utils/          # 应用全局的工具函数
│   └── index.ts        # 应用主入口
├── .env.example        # 环境变量示例文件
└── package.json        # 项目依赖和脚本
```
