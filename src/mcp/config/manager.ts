/**
 * ConfigManager
 * 
 * 统一管理 MCP 模块的所有配置。
 * 该管理器负责：
 * 1. 从默认配置、环境变量、外部传入配置中加载和合并配置。
 * 2. 提供统一的、类型安全的配置访问接口。
 * 3. 对配置进行验证，并提供健康检查。
 * 4. （未来）支持动态配置更新和订阅。
 */
import { MCPAgentConfig } from '../types/index.js';
import { DEFAULT_CONFIG as defaultConfig } from './default.js';
import { validateConfig } from './validator.js';
import _ from 'lodash';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: MCPAgentConfig;

  private constructor(initialConfig?: Partial<MCPAgentConfig>) {
    this.config = this.loadConfig(initialConfig);
  }

  public static getInstance(initialConfig?: Partial<MCPAgentConfig>): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(initialConfig);
    } else if (initialConfig) {
      // 如果已经存在实例，但又传入了新的初始配置，则更新配置
      ConfigManager.instance.updateConfig(initialConfig);
    }
    return ConfigManager.instance;
  }

  /**
   * 加载和合并配置
   * 优先级：外部传入配置 > 环境变量 > 默认配置
   */
  private loadConfig(initialConfig?: Partial<MCPAgentConfig>): MCPAgentConfig {
    const envConfig = this.getEnvConfig();
    const mergedConfig = _.merge({}, defaultConfig, envConfig, initialConfig);
    return mergedConfig as MCPAgentConfig;
  }
  
  /**
   * 从环境变量中读取配置
   */
  private getEnvConfig(): Partial<MCPAgentConfig> {
    const envConfig: Partial<MCPAgentConfig> = {
        llm: {
            apiKey: process.env['LLM_API_KEY'],
            model: process.env['LLM_MODEL'],
            baseURL: process.env['LLM_BASE_URL'],
        }
    };
    return _.omitBy(envConfig, _.isNil);
  }

  /**
   * 更新配置
   */
  public updateConfig(configUpdate: Partial<MCPAgentConfig>): void {
    this.config = _.merge({}, this.config, configUpdate);
  }

  /**
   * 获取完整的配置对象
   */
  public getConfig(): MCPAgentConfig {
    return this.config;
  }
  
  /**
   * 获取配置的健康状态
   */
  public getHealth() {
    return validateConfig(this.config);
  }
}

export const configManager = ConfigManager.getInstance();
