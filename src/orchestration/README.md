## Orchestration（智能体编排）层

Orchestration 层负责多智能体的统一编排：Leader 的启动与注册、Dashboard 子 Agent 的集中注册，以及请求到具体 Agent 的路由（显式/LLM 精准/规则回退/Leader 兜底）。

### 目录结构

```
src/orchestration/
├── bootstrap.ts          # 启动编排：调用 LLM 工厂、启动 Leader 的 MCP、注册 Leader、注册各子 Agent
├── llm.ts                # LLM 工厂：根据环境变量创建并导出 LLM 实例
├── manager.ts            # Agent 管理器：统一注册/查询，维护父子关系（Leader → Sub Agents）
├── router.ts             # 规则路由：显式 agentName / 名称与关键词匹配 / Leader 回退
├── router.ts             # LLM 精准路由：用 LLM 在候选 Agent 中做判断
├── Leader/               # Leader 的 MCP 工具编排
│   ├── index.ts
│   ├── system.ts         # 系统信息工具
│   ├── compare.ts        # 比较两个数
│   └── twoSum.ts         # 两数求和
└── Dashboard/            # Dashboard 子 Agent 集合（按域划分）
    ├── index.ts          # 集中导出需要注册的子 Agent（推荐方式）
    └── Antfe/
        ├── index.ts      # 子 Agent 元数据：name、servers、starter、agentDescription
        └── member.ts     # 子 Agent MCP 服务实现
```

### 启动流程（高层）

1) `bootstrap.ts`
- 调用 `llm.ts` 中的工厂函数创建 LLM 实例。
- 启动 Leader 的 MCP 工具服务。
- 创建 Leader Agent 并注册为 Leader。
- 从 `orchestration/Dashboard/index.ts` 读取子 Agent 列表，逐个启动其 MCP、构建子 Agent、注册为 Leader 的子 Agent。

2) 入口 `src/index.ts`
- 启动时构建全局就绪 Promise：`globals.agentManagerReady = initLeaderOrchestration()`；完成后写入 `globals.agentManager`
- 入口专注 Web 生命周期；Serverless 环境下不主动 `app.listen`，由平台托管（通过 `VERCEL=1` 判断）

### 路由策略（从高到低优先级）

- 显式路由：请求体有 `agentName` 且存在 → 直接命中
- LLM 精准路由（优先且唯一判定）：
- `orchestration/router.ts` 使用 Leader 的 LLM，让模型在“候选子 Agent + Leader”中输出 JSON：
    `{ target: string; reason: string; confidence: number }`
  - 当 `target` 合法且 `confidence ≥ 0.5`（默认阈值）时采用
- 最终回退：Leader 兜底（随后由链式处理决定是否工具调用）

集成点：`services/chat/chat.service.ts` 内执行“显式→LLM→Leader兜底”的路由逻辑，并创建 `AgentChain` 执行。

### 子 Agent 注册与元信息（keywords/aliases）

`orchestration/manager.ts` 支持为 Agent 注册可选 `meta`：
- `keywords`: 关键词列表（便于规则回退命中）
- `aliases`: 别名列表（便于规则回退命中）

注册 API：
```ts
registerLeader(name: string, agent: Agent, description: string, meta?: { keywords?: string[]; aliases?: string[] })
registerSubAgent(parentName: string, name: string, agent: Agent, description?: string, meta?: { keywords?: string[]; aliases?: string[] })
```

### 如何新增一个 Dashboard 子 Agent（推荐流程）

1) 在 `orchestration/Dashboard/<YourAgent>/index.ts` 默认导出：
```ts
export default {
    name: 'your-agent',
    servers: [{ name: 'your-mcp', url: '' }],
    async starter() {
    // 启动 MCP 服务并回填 servers[i].url
    },
    agentDescription: '当用户需要 <YourAgent> 领域的能力时使用',
}
```

2) 将该模块加入集中导出 `orchestration/Dashboard/index.ts`：
```ts
import YourAgent from './YourAgent/index.js'

export const dashboards = [YourAgent]
```

3) 启动时 `bootstrap.ts` 会读取 `dashboards` 列表、启动 MCP、构建子 Agent 并 `registerSubAgent()`；默认会以 `name` 作为 keyword，并生成去掉 `-agent` 的别名。

> 如需更强命中率，可在 `bootstrap.ts` 注册时为该子 Agent 追加更丰富的 `keywords/aliases`。

### 环境变量（LLM 创建）

所有 LLM 相关的环境变量均由 `src/orchestration/llm.ts` 文件统一消费。

- `LLM_PROVIDER`: `qwen` (默认) 或 `deepseek`。
- `LLM_API_KEY`: 必需，对应模型的 API Key。
- `LLM_MODEL`: 必需，要使用的具体模型名称 (e.g., `qwen-vl-plus`, `deepseek-chat`)。

> 说明：Orchestration 层通过 `llm.ts` 模块统一创建和管理 LLM 实例，应用的其他部分（如 `bootstrap.ts`）只管调用，无需关心模型厂商与参数细节，保证了解耦与可替换性。

### 请求示例（无需显式指定 Agent）

```bash
curl -N -X POST http://localhost:3000/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[{"type":"human","content":"请介绍一下 Antfe 团队成员"}],
    "reactVerbose": true
  }'
```

路由决策将自动执行：显式 → LLM → 规则 → Leader 兜底。
