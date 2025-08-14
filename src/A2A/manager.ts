/**
 * Agent Manager（A2A 层）
 * 负责创建、管理和提供多个 Agent 实例。
 * 注意：此处仅负责管理，不参与具体对话流程，保持与 agent 模块解耦。
 */
import { createLogger } from '../utils/logger.js';
import { Agent } from '../agent/agent.js';

const logger = createLogger('AgentManager');

/**
 * 记录 Agent 的实例与其职责描述
 */
interface AgentEntry {
  agent: Agent;
  description: string;
}

export class AgentManager {
  /** agent 名称到实例+描述的映射 */
  private agents: Map<string, AgentEntry> = new Map();
  /** 作为 leader 的 agent 名称（唯一） */
  private leaderName?: string;

  /**
   * 注册/更新一个普通 Agent（向平台登记）
   * - description 可选，缺省为空字符串
   * - 若名称已存在，将覆盖旧记录，并发出 warn 日志
   */
  public addAgent(name: string, agent: Agent, description: string = ''): void {
    if (this.agents.has(name)) {
      logger.warn(`名为 ${name} 的 Agent 已存在，将被覆盖。`);
    }
    this.agents.set(name, { agent, description });
    logger.info(`Agent [${name}] 已添加到管理器。`);
  }

  /**
   * 注册 leader Agent（唯一）
   * - 会自动写入 agents 表
   * - 重复设置将覆盖之前的 leader，并发出 warn
   */
  public registerLeader(name: string, agent: Agent, description: string): void {
    if (this.leaderName && this.leaderName !== name) {
      logger.warn(`Leader 将从 [${this.leaderName}] 切换为 [${name}]。`);
    }
    // 注册 leader agent
    this.addAgent(name, agent, description);
    this.leaderName = name;
    logger.info(`Leader 已注册: ${name}`);
  }

  /** 获取 leader 名称 */
  public getLeaderName(): string | undefined {
    return this.leaderName;
  }

  /** 获取 leader 实例 */
  public getLeader(): Agent | undefined {
    if (!this.leaderName) return undefined;
    return this.agents.get(this.leaderName)?.agent;
  }

  /** 获取指定名称的 Agent 实例 */
  public getAgent(name: string): Agent | undefined {
    if (!this.agents.has(name)) {
      logger.warn(`请求的 Agent [${name}] 不存在。`);
      return undefined;
    }
    return this.agents.get(name)?.agent;
  }

  /**
   * 获取指定名称的 Agent 描述
   */
  public getAgentDescription(name: string): string | undefined {
    return this.agents.get(name)?.description;
  }

  /**
   * 列出已注册的 Agent 名称
   */
  public listAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * 列出所有 Agent 的简介信息
   */
  public listAgents(): Array<{ name: string; description: string; isLeader: boolean }> {
    const leader = this.leaderName;
    return Array.from(this.agents.entries()).map(([name, entry]) => ({
      name,
      description: entry.description,
      isLeader: leader === name,
    }));
  }
}


