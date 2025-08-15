## A2A（Agents-to-Agents）层

A2A 层负责多智能体的统一编排：Leader 的启动与注册、Dashboard 子 Agent 的集中注册，以及请求到具体 Agent 的路由（显式/LLM 精准/规则回退/Leader 兜底）。

### 目录结构

```
src/A2A/
├── bootstrap.ts          # 启动编排：创建 LLM、启动 Leader 的 MCP、注册 Leader、注册各子 Agent
├── manager.ts            # Agent 管理器：统一注册/查询，维护父子关系（Leader → Sub Agents）
├── router.ts             # 规则路由：显式 agentName / 名称与关键词匹配 / Leader 回退
├── router.ts             # LLM 精准路由：用 LLM 在候选 Agent 中做判断
├── Leader/               # Leader 的 MCP 工具编排
│   ├── index.ts
│   ├── system.ts
│   └── weather.ts
└── Dashboard/            # Dashboard 子 Agent 集合（按域划分）
    ├── index.ts          # 集中导出需要注册的子 Agent（推荐方式）
    └── Antfe/
        ├── index.ts      # 子 Agent 元数据：name、servers、starter、agentDescription
        └── member.ts     # 子 Agent MCP 服务实现
```

### 启动流程（高层）

1) `bootstrap.ts`
- 启动 Leader 的 MCP 工具服务
- 基于环境变量创建 LLM（A2A 内部负责厂商选择，不由入口决定）
- 创建 Leader Agent 并注册为 Leader
- 从 `A2A/Dashboard/index.ts` 读取子 Agent 列表，逐个启动其 MCP、构建子 Agent、注册为 Leader 的子 Agent

2) 入口 `src/index.ts`
- 启动时构建全局就绪 Promise：`globals.agentManagerReady = initLeaderA2A()`；完成后写入 `globals.agentManager`
- 入口专注 Web 生命周期；Serverless 环境下不主动 `app.listen`，由平台托管（通过 `VERCEL=1` 判断）

### 路由策略（从高到低优先级）

- 显式路由：请求体有 `agentName` 且存在 → 直接命中
- LLM 精准路由（优先且唯一判定）：
- `A2A/router.ts` 使用 Leader 的 LLM，让模型在“候选子 Agent + Leader”中输出 JSON：
    `{ target: string; reason: string; confidence: number }`
  - 当 `target` 合法且 `confidence ≥ 0.5`（默认阈值）时采用
- 最终回退：Leader 兜底（随后由链式处理决定是否工具调用）

集成点：`services/chat/chat.service.ts` 内执行“显式→LLM→Leader兜底”的路由逻辑，并创建 `AgentChain` 执行。

### 子 Agent 注册与元信息（keywords/aliases）

`A2A/manager.ts` 支持为 Agent 注册可选 `meta`：
- `keywords`: 关键词列表（便于规则回退命中）
- `aliases`: 别名列表（便于规则回退命中）

注册 API：
```ts
registerLeader(name: string, agent: Agent, description: string, meta?: { keywords?: string[]; aliases?: string[] })
registerSubAgent(parentName: string, name: string, agent: Agent, description?: string, meta?: { keywords?: string[]; aliases?: string[] })
```

### 如何新增一个 Dashboard 子 Agent（推荐流程）

1) 在 `A2A/Dashboard/<YourAgent>/index.ts` 默认导出：
```ts
export default {
  name: 'your-agent',
  servers: [ { name: 'your-mcp', url: '' } ],
  async starter() {
    // 启动 MCP 服务并回填 servers[i].url
  },
  agentDescription: '当用户需要 <YourAgent> 领域的能力时使用',
}
```

2) 将该模块加入集中导出 `A2A/Dashboard/index.ts`：
```ts
import YourAgent from './YourAgent/index.js';
export const dashboards = [ YourAgent ];
```

3) 启动时 `bootstrap.ts` 会读取 `dashboards` 列表、启动 MCP、构建子 Agent 并 `registerSubAgent()`；默认会以 `name` 作为 keyword，并生成去掉 `-agent` 的别名。

> 如需更强命中率，可在 `bootstrap.ts` 注册时为该子 Agent 追加更丰富的 `keywords/aliases`。

### 环境变量（LLM 创建）

- `LLM_PROVIDER`: `deepseek`（默认）或 `openai`（可扩展）
- `LLM_API_KEY`、`LLM_MODEL`、`LLM_BASE_URL`、`LLM_TEMPERATURE`、`LLM_STREAMING`

> 说明：A2A 层统一创建 LLM，入口不参与模型厂商与参数细节，保证解耦与可替换性。

### 请求示例（无需显式指定 Agent）

```bash
curl -N -X POST http://localhost:3000/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[{"type":"human","content":"请让 Antfe 介绍一下团队成员"}],
    "reactVerbose": true
  }'
```

路由决策将自动执行：显式 → LLM → 规则 → Leader 兜底。


