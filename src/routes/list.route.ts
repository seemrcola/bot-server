import type { Request, Response } from 'express'
import { Router } from 'express'
import { globals } from '../globals.js'

const listRouter: Router = Router()

// GET /api/list/tools - 列出所有可用工具（来自所有已连接 MCP 服务）
listRouter.get('/tools', async (_req: Request, res: Response) => {
    try {
        await globals.agentManagerReady
        const agentManager = globals.agentManager
        if (!agentManager)
            return res.status(500).json({ error: 'AgentManager 未初始化' })

        // 通过 Leader 的 ClientManager 获取工具清单
        const leaderAgent = agentManager.getLeader()
        if (!leaderAgent)
            return res.status(500).json({ error: 'Leader 未注册' })
        const tools = await leaderAgent.clientManager.getAllTools()
        return res.json({ success: true, data: tools })
    }
    catch (e: any) {
        return res.status(500).json({ success: false, error: e?.message || String(e) })
    }
})

// GET /api/list/agents - 列出所有已注册 Agent
listRouter.get('/agents', async (_req: Request, res: Response) => {
    try {
        await globals.agentManagerReady
        const agentManager = globals.agentManager
        if (!agentManager)
            return res.status(500).json({ error: 'AgentManager 未初始化' })

        const agents = agentManager.listAgents()
        return res.json({ success: true, data: agents })
    }
    catch (e: any) {
        return res.status(500).json({ success: false, error: e?.message || String(e) })
    }
})

export { listRouter }
