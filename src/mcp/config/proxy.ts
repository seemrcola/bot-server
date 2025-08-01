/**
 * 配置代理
 * 为各个模块提供简洁的配置接口
 */

import { getConfigCenter } from './center.js';
import type { LLMConfig, MCPClientConfig, MCPServerConfig, MCPAgentConfig } from '../types/index.js';

/**
 * 创建LLM配置代理
 */
export function createLLMConfigProxy() {
  const configCenter = getConfigCenter();
  
  return {
    getLLMConfig(): LLMConfig {
      return configCenter.getLLMConfig();
    },
    
    updateLLMConfig(config: Partial<LLMConfig>): void {
      configCenter.updateLLMConfig(config, 'llm-proxy');
    }
  };
}

/**
 * 创建客户端配置代理
 */
export function createClientConfigProxy() {
  const configCenter = getConfigCenter();
  
  return {
    getClientConfig(): MCPClientConfig {
      return configCenter.getClientConfig();
    },
    
    updateClientConfig(config: Partial<MCPClientConfig>): void {
      configCenter.updateClientConfig(config, 'client-proxy');
    }
  };
}

/**
 * 创建服务端配置代理
 */
export function createServerConfigProxy() {
  const configCenter = getConfigCenter();
  
  return {
    getServerConfig(): MCPServerConfig {
      return configCenter.getServerConfig();
    },
    
    updateServerConfig(config: Partial<MCPServerConfig>): void {
      configCenter.updateServerConfig(config, 'server-proxy');
    }
  };
}

/**
 * 创建Agent配置代理
 */
export function createAgentConfigProxy() {
  const configCenter = getConfigCenter();
  
  return {
    getConfig(): MCPAgentConfig {
      return configCenter.getConfig();
    },
    
    updateConfig(config: Partial<MCPAgentConfig>): void {
      configCenter.updateConfig(config, 'agent-proxy');
    }
  };
}

/**
 * 快速配置 - 链式调用
 */
export function quickConfig() {
  const configCenter = getConfigCenter();
  
  return {
    llm: (config: Partial<LLMConfig>) => {
      configCenter.updateLLMConfig(config, 'quick-config');
      return quickConfig();
    },
    
    client: (config: Partial<MCPClientConfig>) => {
      configCenter.updateClientConfig(config, 'quick-config');
      return quickConfig();
    },
    
    server: (config: Partial<MCPServerConfig>) => {
      configCenter.updateServerConfig(config, 'quick-config');
      return quickConfig();
    }
  };
}

/**
 * 订阅配置变更
 */
export function onConfigChange(module: string, callback: (config: any) => void): () => void {
  const configCenter = getConfigCenter();
  return configCenter.subscribe(module, callback);
}