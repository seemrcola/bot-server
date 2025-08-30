## Orchestration（智能体编排）层

Orchestration 层负责多智能体的统一编排：Leader 的启动与注册、Dashboard 子 Agent 的集中注册，以及请求到具体 Agent 的路由（显式/LLM 精准/规则回退/Leader 兜底）。

### 目录结构

```
src/orchestration/
├── bootstrap.ts          # 启动编排：调用 LLM 工厂、启动 Leader 的 MCP、注册 Leader、注册各子 Agent
├── llm.ts                # LLM 工厂：根据环境变量创建并导出 LLM 实例
├── manager.ts            # Agent 管理器：统一注册/查询，维护父子关系（Leader → Sub Agents）
├── router.ts             # LLM智能路由：使用Leader的LLM进行单Agent和多Agent路由决策
├── Leader/               # Leader 的 MCP 工具编排
│   ├── index.ts
│   ├── system.ts         # 系统信息工具
│   ├── compare.ts        # 比较两个数
│   └── twoSum.ts         # 两数求和
└── Dashboard/            # Dashboard 子 Agent 集合（按域划分）
    ├── index.ts          # 集中导出需要注册的子 Agent（推荐方式）
    ├── WebHelper/        # 网页助手子Agent（新增）
    │   ├── index.ts      # WebHelper Agent 元数据和启动器
    │   └── webCatcher/   # 智能网页抓取工具集
    │       ├── index.ts          # 自动化工具注册
    │       ├── types.ts          # 类型定义
    │       └── tools/            # 自管理MCP工具
    │           ├── url-validator-tool.ts    # URL验证工具
    │           ├── html-fetcher-tool.ts     # HTML获取工具
    │           ├── content-parser-tool.ts   # 内容解析工具
    │           └── result-formatter-tool.ts # LLM驱动格式化工具
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
- 入口专注 Web 生命周期；主动监听端口启动服务器

### 路由策略（从高到低优先级）

- 显式路由：请求体有 `agentName` 且存在 → 直接命中
- LLM 智能路由（支持1-N个Agent）：
  - 单Agent模式：`selectAgentByLLM()` 返回最佳匹配Agent
  - 多Agent模式：`selectMultipleAgentsByLLM()` 返回多个匹配Agent并分配任务
  - 置信度阈值：单Agent默认0.5，多Agent默认0.5
- 最终回退：Leader 兜底（随后由链式处理决定是否工具调用）

集成点：`services/chat/chat.service.ts` 内执行“显式→LLM→Leader兜底”的路由逻辑，并创建 `AgentChain` 执行。

### MCP工具自管理注册机制

为了符合单一职责原则，每个MCP工具现在管理自己的注册信息：

```typescript
// 每个工具类实现自管理注册
export class SomeTool {
    /**
     * 获取工具定义信息
     */
    static getToolDefinition() {
        return {
            name: 'toolName',
            schema: {
                title: '工具标题',
                description: '工具描述',
                inputSchema: SomeSchema.shape,
            },
            handler: this.handleToolCall.bind(this),
        }
    }

    /**
     * 工具调用处理器
     */
    static async handleToolCall(params: any) {
        // 具体实现
    }
}
```

这种设计的优势：
- **单一职责**：工具自己管理注册信息
- **模块化**：每个工具都是独立的模块
- **类型安全**：编译时检查工具定义
- **易于维护**：修改工具时只需修改对应文件

### LLM驱动的智能格式化

`resultFormatter`工具已重构为LLM驱动的智能格式化工具：
- **真实LLM集成**：使用项目配置的LLM实例进行格式化
- **专业提示词**：针对不同格式（Markdown、JSON、摘要、纯文本）优化的提示词
- **智能容错**：LLM失败时自动降级到备用格式化方案
- **性能监控**：详细记录格式化耗时和内容长度变化

`orchestration/manager.ts` 支持为 Agent 注册可选 `meta`：
- `keywords`: 关键词列表（便于规则回退命中）
- `aliases`: 别名列表（便于规则回退命中）

注册 API：
```
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

集成点：`services/chat/chat.service.ts` 内执行"显式→LLM→Leader兜底"的路由逻辑，并创建 `AgentChain` 执行。

### 智能网页抓取示例

```bash
# 使用WebHelper Agent进行网页抓取和智能格式化
curl -N -X POST http://localhost:3000/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[{"type":"human","content":"请抓取 https://example.com 的内容并用Markdown格式输出"}],
    "agentName": "web-helper-agent",
    "reactVerbose": true
  }'

# 支持多种输出格式
curl -N -X POST http://localhost:3000/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[{"type":"human","content":"请生成网页内容的JSON结构化数据"}],
    "agentName": "web-helper-agent"
  }'
```
