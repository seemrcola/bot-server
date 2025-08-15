/**
 * 全局容器，用于在应用程序的不同部分之间共享单例实例。
 * 这有助于避免循环依赖问题。
 */
import { AgentManager } from './A2A/manager.js';

interface GlobalContainer {
  agentManager?: AgentManager;
  agentManagerReady?: Promise<void>;
}

export const globals: GlobalContainer = {};
