/**
 * Agent Manager
 * 负责创建、管理和提供多个 Agent 实例。
 */
import { createLogger } from '../utils/logger.js';
import { Agent } from './agent.js';

const logger = createLogger('AgentManager');

export class AgentManager {
  private agents: Map<string, Agent> = new Map();

  public addAgent(name: string, agent: Agent): void {
    if (this.agents.has(name)) {
      logger.warn(`名为 ${name} 的 Agent 已存在，将被覆盖。`);
    }
    this.agents.set(name, agent);
    logger.info(`Agent [${name}] 已添加到管理器。`);
  }

  public getAgent(name: string): Agent | undefined {
    if (!this.agents.has(name)) {
      logger.warn(`请求的 Agent [${name}] 不存在。`);
      return undefined;
    }
    return this.agents.get(name);
  }

  public listAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }
}
