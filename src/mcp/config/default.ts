/**
 * MCP 默认配置
 * 提供所有模块的默认配置值，不依赖外部环境
 */

import { MCPAgentConfig, ToolConfig } from '../types/index.js';

// 默认 JoJo 工具配置
const defaultJoJoTool: ToolConfig = {
  name: 'jojo',
  enabled: true,
  patterns: [
    'jojo', 'JoJo', 'JOJO',
  ],
  parameters: {
    trigger: {
      patterns: [
        '(.+?)(?:jojo|JoJo|JOJO)',
        '(jojo|JoJo|JOJO)(.+?)',
        '(.+?)(?:替身|stand)',
        '(.+?)(?:承太郎|迪奥|dio)'
      ],
      default: 'jojo',
      required: false,
      type: 'string'
    }
  },
  description: 'JoJo动漫机器人，当用户说出"jojo"时返回JoJo相关回复',
  examples: ['jojo', 'JoJo', 'JoJo的奇妙冒险', '承太郎', '替身']
};

/**
 * MCP 模块默认配置
 * 这些配置不依赖任何外部环境，可以独立运行
 */
export const DEFAULT_CONFIG: MCPAgentConfig = {
  enabled: true,                               // 是否启用MCP代理
  server: {                                    // MCP服务端配置
    port: 3001,                                // 端口
    host: 'localhost'                          // 主机
  },
  client: {                                    // MCP客户端配置
    serverUrl: 'ws://localhost:3001',          // 服务端URL
    timeout: 30000,                            // 超时时间
    reconnectDelay: 5000,                      // 重连延迟
    maxReconnectAttempts: 3                    // 最大重连次数
  },
  tools: {                                     // 工具配置
    jojo: defaultJoJoTool                      // JoJo动漫机器人工具
  },
  nlp: {                                       // NLP配置
    confidenceThreshold: 0.7,                  // 置信度阈值
    maxRetries: 3,                             // 最大重试次数
    useLLM: true                               // 是否使用LLM
  },
  logging: {                                   // 日志配置
    level: 'info',                             // 日志级别
    enablePerformanceLogging: true             // 是否启用性能日志
  },
  llm: {                                       // LLM配置（参考 langchain ChatOpenAI）
    apiKey: '',                                // API密钥
    model: 'deepseek-chat',                    // 模型
    temperature: 0.7,                          // 温度
    streaming: true,                           // 是否启用流式输出
    configuration: {                           // 配置对象
      baseURL: 'https://api.deepseek.com/v1'   // API基础URL
    },
    timeout: 30000,                            // 超时时间
    maxRetries: 3,                             // 最大重试次数
    maxTokens: 4000                            // 最大token数
  }
};

/**
 * 获取默认配置的深拷贝
 */
export function getDefaultConfig(): MCPAgentConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

/**
 * 获取特定模块的默认配置
 */
export function getDefaultLLMConfig() {
  return { ...DEFAULT_CONFIG.llm };
}

export function getDefaultClientConfig() {
  return { ...DEFAULT_CONFIG.client };
}

export function getDefaultServerConfig() {
  return { ...DEFAULT_CONFIG.server };
}

export function getDefaultToolsConfig() {
  return { ...DEFAULT_CONFIG.tools };
}

export function getDefaultNLPConfig() {
  return { ...DEFAULT_CONFIG.nlp };
}

export function getDefaultLoggingConfig() {
  return { ...DEFAULT_CONFIG.logging };
}
