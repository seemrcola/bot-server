/**
 * 全局容器，用于在应用程序的不同部分之间共享单例实例。
 * 这有助于避免循环依赖问题。
 */
import { Agent } from './agent/agent.js';

interface GlobalContainer {
  agent?: Agent;
}

export const globals: GlobalContainer = {};
