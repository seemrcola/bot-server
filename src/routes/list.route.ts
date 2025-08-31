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

        // 汇总所有 Agent 的工具
        const allAgents = agentManager.listAgents()
        const allTools: any[] = []

        for (const agentInfo of allAgents) {
            const agent = agentManager.getAgent(agentInfo.name)
            if (agent) {
                const tools = await agent.clientManager.getAllTools()
                // 为每个工具添加来源 Agent 信息
                const toolsWithSource = tools.map(tool => ({
                    ...tool,
                    sourceAgent: agentInfo.name,
                    agentDescription: agentInfo.description,
                }))
                allTools.push(...toolsWithSource)
            }
        }

        return res.json({ success: true, data: allTools })
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
