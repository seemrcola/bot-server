import type { Agent } from '../agent/agent.js'
/**
 * Agent Manager（Orchestration 层）
 * 负责创建、管理和提供多个 Agent 实例。
 * 注意：此处仅负责管理，不参与具体对话流程，保持与 agent 模块解耦。
 */
import { createLogger } from '../utils/logger.js'

const logger = createLogger('AgentManager')

/**
 * 记录 Agent 的实例与其职责描述
 */
interface AgentEntry {
    agent: Agent
    description: string
    meta: { keywords?: string[], aliases?: string[] } | undefined
}

export class AgentManager {
    /** agent 名称到实例+描述的映射 */
    private agents: Map<string, AgentEntry> = new Map()
    /** 作为 leader 的 agent 名称（唯一） */
    private leaderName?: string
    /** 父子关系映射：K=父(通常为leader)；V=子Agent名称列表 */
    private parentToChildren: Map<string, string[]> = new Map()

    /**
     * 注册/更新一个普通 Agent（向平台登记）
     * - description 可选，缺省为空字符串
     * - 若名称已存在，将覆盖旧记录，并发出 warn 日志
     */
    public addAgent(name: string, agent: Agent, description: string = '', meta?: AgentEntry['meta']): void {
        if (this.agents.has(name)) {
            logger.warn(`名为 ${name} 的 Agent 已存在，将被覆盖。`)
        }
        this.agents.set(name, { agent, description, meta: meta as AgentEntry['meta'] })
        logger.info(`Agent [${name}] 已添加到管理器。`)
    }

    /**
     * 注册 leader Agent（唯一）
     * - 会自动写入 agents 表
     * - 重复设置将覆盖之前的 leader，并发出 warn
     */
    public registerLeader(name: string, agent: Agent, description: string, meta?: AgentEntry['meta']): void {
        if (this.leaderName && this.leaderName !== name) {
            logger.warn(`Leader 将从 [${this.leaderName}] 切换为 [${name}]。`)
        }
        // 注册 leader agent
        this.addAgent(name, agent, description, meta)
        this.leaderName = name
        logger.info(`Leader 已注册: ${name}`)
    }

    /**
     * 注册子 Agent（隶属于某个父 Agent，比如 Leader）
     */
    public registerSubAgent(parentName: string, name: string, agent: Agent, description: string = '', meta?: AgentEntry['meta']): void {
        this.addAgent(name, agent, description, meta)
        const list = this.parentToChildren.get(parentName) ?? []
        if (!list.includes(name)) {
            list.push(name)
            this.parentToChildren.set(parentName, list)
        }
        logger.info(`子 Agent 已注册: ${name} (父: ${parentName})`)
    }

    /** 获取 leader 名称 */
    public getLeaderName(): string | undefined {
        return this.leaderName
    }

    /** 获取 leader 实例 */
    public getLeader(): Agent | undefined {
        if (!this.leaderName)
            return undefined
        return this.agents.get(this.leaderName)?.agent
    }

    /** 获取指定名称的 Agent 实例 */
    public getAgent(name: string): Agent | undefined {
        if (!this.agents.has(name)) {
            logger.warn(`请求的 Agent [${name}] 不存在。`)
            return undefined
        }
        return this.agents.get(name)?.agent
    }

    /**
     * 列出某个父 Agent（如 Leader）的所有子 Agent 名称
     */
    public listSubAgentNames(parentName: string): string[] {
        return [...(this.parentToChildren.get(parentName) ?? [])]
    }

    /**
     * 列出某个父 Agent 的子 Agent 概览
     */
    public listSubAgents(parentName: string): Array<{ name: string, description: string, meta?: AgentEntry['meta'] }> {
        const names = this.listSubAgentNames(parentName)
        return names.map(name => ({ name, description: this.getAgentDescription(name) ?? '', meta: this.agents.get(name)?.meta }))
    }

    /** 获取指定名称的 Agent 描述 */
    public getAgentMeta(name: string): AgentEntry['meta'] | undefined {
        return this.agents.get(name)?.meta
    }

    /**
     * 获取指定名称的 Agent 描述
     */
    public getAgentDescription(name: string): string | undefined {
        return this.agents.get(name)?.description
    }

    /**
     * 列出已注册的 Agent 名称
     */
    public listAgentNames(): string[] {
        return Array.from(this.agents.keys())
    }

    /**
     * 列出所有 Agent 的简介信息
     */
    public listAgents(): Array<{ name: string, description: string, isLeader: boolean }> {
        const leader = this.leaderName
        return Array.from(this.agents.entries()).map(([name, entry]) => ({
            name,
            description: entry.description,
            isLeader: leader === name,
        }))
    }

    /**
     * 批量获取多个 Agent 实例
     * @param names Agent 名称列表
     * @returns Agent 实例数组，不存在的返回 undefined
     */
    public getMultipleAgents(names: string[]): Array<{ name: string, agent: Agent | undefined }> {
        return names.map(name => ({
            name,
            agent: this.getAgent(name),
        }))
    }

    /**
     * 批量获取多个有效的 Agent 实例（过滤不存在的）
     * @param names Agent 名称列表
     * @returns 有效的 Agent 实例数组
     */
    public getValidAgents(names: string[]): Array<{ name: string, agent: Agent }> {
        const result: Array<{ name: string, agent: Agent }> = []
        for (const name of names) {
            const agent = this.getAgent(name)
            if (agent) {
                result.push({ name, agent })
            }
            else {
                logger.warn(`Agent [${name}] 不存在，已跳过`)
            }
        }
        return result
    }
}
