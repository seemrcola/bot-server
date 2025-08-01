/**
 * MCP 配置中心
 * 统一的配置管理中心，解决配置不同步问题
 * 
 * 特性：
 * - 单例模式，确保配置一致性
 * - 订阅通知机制，配置变更实时同步
 * - 模块化配置获取，支持按需订阅
 * - 配置变更历史记录
 */

import { 
  MCPAgentConfig, 
  LLMConfig, 
  MCPClientConfig, 
  MCPServerConfig, 
  ToolsConfig, 
  NLPConfig, 
  LoggingConfig 
} from '../types/index.js';
import { getDefaultConfig } from './default.js';
import { createMCPLogger } from '../utils/logger.js';
import { deepMerge, deepClone } from '../utils/object-utils.js';

const logger = createMCPLogger('ConfigCenter');

// 配置变更事件类型
export type ConfigChangeEvent = {
  module: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  source: string; // 变更来源
};

// 配置订阅回调函数类型
export type ConfigSubscriber = (config: any, event?: ConfigChangeEvent) => void;

/**
 * 配置中心 - 单例模式
 */
export class ConfigCenter {
  private static instance: ConfigCenter;                               // 单例模式
  private currentConfig: MCPAgentConfig;                               // 当前配置
  private subscribers: Map<string, Set<ConfigSubscriber>> = new Map(); // 订阅者
  private changeHistory: ConfigChangeEvent[] = [];                     // 变更历史
  private readonly maxHistorySize = 100;                               // 最大历史记录大小

  private constructor() {
    // 使用默认配置初始化
    this.currentConfig = getDefaultConfig();
    logger.info('配置中心已初始化，使用默认配置');
  }

  /**
   * 获取配置中心实例
   */
  static getInstance(): ConfigCenter {
    if (!ConfigCenter.instance) {
      ConfigCenter.instance = new ConfigCenter();
    }
    return ConfigCenter.instance;
  }

  /**
   * 初始化配置中心（可选）
   * 如果需要自定义初始配置，可以在获取实例前调用此方法
   * @param initialConfig 初始配置
   */
  static initialize(initialConfig: Partial<MCPAgentConfig>): ConfigCenter {
    if (ConfigCenter.instance) {
      logger.warn('配置中心已经初始化，将更新现有配置');
      ConfigCenter.instance.updateConfig(initialConfig, 'initialize');
    } else {
      ConfigCenter.instance = new ConfigCenter();
      ConfigCenter.instance.updateConfig(initialConfig, 'initialize');
    }
    return ConfigCenter.instance;
  }

  // ==================== 配置获取 ====================

  /**
   * 获取完整配置
   */
  getConfig(): MCPAgentConfig {
    return deepClone(this.currentConfig);
  }

  /**
   * 获取 LLM 配置
   */
  getLLMConfig(): LLMConfig {
    if (!this.currentConfig.llm) {
      throw new Error('LLM配置未初始化');
    }
    return deepClone(this.currentConfig.llm);
  }

  /**
   * 获取客户端配置
   */
  getClientConfig(): MCPClientConfig {
    return deepClone(this.currentConfig.client);
  }

  /**
   * 获取服务端配置
   */
  getServerConfig(): MCPServerConfig {
    return deepClone(this.currentConfig.server);
  }

  /**
   * 获取工具配置
   */
  getToolsConfig(): ToolsConfig {
    return deepClone(this.currentConfig.tools);
  }

  /**
   * 获取 NLP 配置
   */
  getNLPConfig(): NLPConfig {
    return deepClone(this.currentConfig.nlp);
  }

  /**
   * 获取日志配置
   */
  getLoggingConfig(): LoggingConfig {
    return deepClone(this.currentConfig.logging);
  }

  // ==================== 配置更新 ====================

  /**
   * 更新完整配置
   */
  updateConfig(newConfig: Partial<MCPAgentConfig>, source: string = 'unknown'): void {
    const oldConfig = this.getConfig();
    this.currentConfig = deepMerge(this.currentConfig, newConfig);
    
    // 记录变更历史
    this.recordChange('config', oldConfig, this.getConfig(), source);
    
    // 通知所有订阅者
    this.notifySubscribers('config', this.getConfig());
    
    logger.info(`配置已更新，来源: ${source}`);
  }

  /**
   * 更新 LLM 配置
   */
  updateLLMConfig(llmConfig: Partial<LLMConfig>, source: string = 'unknown'): void {
    const oldConfig = this.getLLMConfig();
    if (!this.currentConfig.llm) {
      throw new Error('LLM配置未初始化');
    }
    this.currentConfig.llm = deepMerge(this.currentConfig.llm, llmConfig);
    
    this.recordChange('llm', oldConfig, this.getLLMConfig(), source);
    this.notifySubscribers('llm', this.getLLMConfig());
    
    logger.info(`LLM配置已更新，来源: ${source}`);
  }

  /**
   * 更新客户端配置
   */
  updateClientConfig(clientConfig: Partial<MCPClientConfig>, source: string = 'unknown'): void {
    const oldConfig = this.getClientConfig();
    this.currentConfig.client = deepMerge(this.currentConfig.client, clientConfig);
    
    this.recordChange('client', oldConfig, this.getClientConfig(), source);
    this.notifySubscribers('client', this.getClientConfig());
    
    logger.info(`客户端配置已更新，来源: ${source}`);
  }

  /**
   * 更新服务端配置
   */
  updateServerConfig(serverConfig: Partial<MCPServerConfig>, source: string = 'unknown'): void {
    const oldConfig = this.getServerConfig();
    this.currentConfig.server = deepMerge(this.currentConfig.server, serverConfig);
    
    this.recordChange('server', oldConfig, this.getServerConfig(), source);
    this.notifySubscribers('server', this.getServerConfig());
    
    logger.info(`服务端配置已更新，来源: ${source}`);
  }

  /**
   * 更新工具配置
   */
  updateToolsConfig(toolsConfig: Partial<ToolsConfig>, source: string = 'unknown'): void {
    const oldConfig = this.getToolsConfig();
    this.currentConfig.tools = deepMerge(this.currentConfig.tools, toolsConfig);
    
    this.recordChange('tools', oldConfig, this.getToolsConfig(), source);
    this.notifySubscribers('tools', this.getToolsConfig());
    
    logger.info(`工具配置已更新，来源: ${source}`);
  }

  /**
   * 更新 NLP 配置
   */
  updateNLPConfig(nlpConfig: Partial<NLPConfig>, source: string = 'unknown'): void {
    const oldConfig = this.getNLPConfig();
    this.currentConfig.nlp = deepMerge(this.currentConfig.nlp, nlpConfig);
    
    this.recordChange('nlp', oldConfig, this.getNLPConfig(), source);
    this.notifySubscribers('nlp', this.getNLPConfig());
    
    logger.info(`NLP配置已更新，来源: ${source}`);
  }

  /**
   * 更新日志配置
   */
  updateLoggingConfig(loggingConfig: Partial<LoggingConfig>, source: string = 'unknown'): void {
    const oldConfig = this.getLoggingConfig();
    this.currentConfig.logging = deepMerge(this.currentConfig.logging, loggingConfig);
    
    this.recordChange('logging', oldConfig, this.getLoggingConfig(), source);
    this.notifySubscribers('logging', this.getLoggingConfig());
    
    logger.info(`日志配置已更新，来源: ${source}`);
  }

  // ==================== 订阅机制 ====================

  /**
   * 订阅配置变更
   * @param module 模块名称 ('config', 'llm', 'client', 'server', 'tools', 'nlp', 'logging')
   * @param callback 回调函数
   * @returns 取消订阅函数
   */
  subscribe(module: string, callback: ConfigSubscriber): () => void {
    if (!this.subscribers.has(module)) {
      this.subscribers.set(module, new Set());
    }
    
    this.subscribers.get(module)!.add(callback);
    
    // 立即发送当前配置
    const currentConfig = this.getConfigForModule(module);
    if (currentConfig) {
      callback(currentConfig);
    }
    
    logger.debug(`模块 ${module} 已订阅配置变更`);
    
    // 返回取消订阅函数
    return () => {
      this.subscribers.get(module)?.delete(callback);
      logger.debug(`模块 ${module} 已取消订阅配置变更`);
    };
  }

  /**
   * 通知订阅者
   */
  private notifySubscribers(module: string, config: any): void {
    const subscribers = this.subscribers.get(module);
    if (subscribers) {
      const event = this.changeHistory[this.changeHistory.length - 1];
      subscribers.forEach(callback => {
        try {
          callback(config, event);
        } catch (error) {
          logger.error(`通知订阅者失败: ${error}`);
        }
      });
    }
  }

  /**
   * 获取指定模块的配置
   */
  private getConfigForModule(module: string): any {
    switch (module) {
      case 'config': return this.getConfig();
      case 'llm': return this.getLLMConfig();
      case 'client': return this.getClientConfig();
      case 'server': return this.getServerConfig();
      case 'tools': return this.getToolsConfig();
      case 'nlp': return this.getNLPConfig();
      case 'logging': return this.getLoggingConfig();
      default: return null;
    }
  }

  // ==================== 配置历史 ====================

  /**
   * 记录配置变更
   */
  private recordChange(module: string, oldValue: any, newValue: any, source: string): void {
    const event: ConfigChangeEvent = {
      module,
      oldValue,
      newValue,
      timestamp: new Date(),
      source
    };
    
    this.changeHistory.push(event);
    
    // 限制历史记录大小
    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory.shift();
    }
  }

  /**
   * 获取配置变更历史
   */
  getChangeHistory(module?: string): ConfigChangeEvent[] {
    if (module) {
      return this.changeHistory.filter(event => event.module === module);
    }
    return [...this.changeHistory];
  }

  // ==================== 工具方法 ====================

  /**
   * 重置配置为默认值
   */
  resetConfig(source: string = 'reset'): void {
    const oldConfig = this.getConfig();
    this.currentConfig = getDefaultConfig();
    
    this.recordChange('config', oldConfig, this.getConfig(), source);
    this.notifySubscribers('config', this.getConfig());
    
    logger.info(`配置已重置为默认值，来源: ${source}`);
  }

  /**
   * 获取配置摘要
   */
  getConfigSummary() {
    return {
      enabled: this.currentConfig.enabled,
      serverPort: this.currentConfig.server.port,
      clientUrl: this.currentConfig.client.serverUrl,
      toolsCount: Object.keys(this.currentConfig.tools).length,
      enabledTools: Object.keys(this.currentConfig.tools).filter(name => this.currentConfig.tools[name]?.enabled),
      hasJoJoTool: !!(this.currentConfig.tools['jojo']?.enabled),
      llmProvider: this.currentConfig.llm?.model || 'none',
      logLevel: this.currentConfig.logging.level,
      subscribersCount: Array.from(this.subscribers.values()).reduce((sum, set) => sum + set.size, 0),
      changeHistoryCount: this.changeHistory.length
    };
  }
}

/**
 * 获取配置中心实例的便捷函数
 */
export function getConfigCenter(): ConfigCenter {
  return ConfigCenter.getInstance();
}

/**
 * 初始化 MCP 配置的便捷函数
 * @param config 自定义配置
 * @returns 配置中心实例
 */
export function initializeMCPConfig(config: Partial<MCPAgentConfig>): ConfigCenter {
  return ConfigCenter.initialize(config);
}
