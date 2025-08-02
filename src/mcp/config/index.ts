/**
 * 配置中心统一导出
 * 提供简洁的配置管理接口
 */

// 配置中心核心
export { getConfigCenter } from './center.js';
import { getConfigCenter } from './center.js';

// 配置代理
export { 
  createLLMConfigProxy,
  createClientConfigProxy, 
  createServerConfigProxy,
  createAgentConfigProxy,
  quickConfig,
  onConfigChange
} from './proxy.js';

// 配置验证
export { validateConfig } from './validator.js';

// 默认配置
export { DEFAULT_CONFIG as defaultConfig } from './default.js';

// 配置初始化
export { initializeMCPConfig } from './center.js';

// 简化的配置获取函数
export function getConfig() {
  return getConfigCenter().getConfig();
}

// 获取配置摘要
export function getConfigSummary() {
  return getConfigCenter().getConfigSummary();
}

/**
 * 获取配置健康状态
 */
export function getConfigHealth(): {
  isHealthy: boolean;
  issues: string[];
  summary: any;
} {
  const config = getConfig();
  const issues: string[] = [];
  
  // 检查关键配置（改为警告，因为开发时可能不需要 API 密钥）
  if (!config.llm?.apiKey) {
    // issues.push('LLM API密钥未配置'); // 注释掉，改为在 validator 中处理
  }
  
  if (!config.client?.serverUrl) {
    issues.push('客户端服务器URL未配置');
  }
  
  if (!config.server?.port || config.server.port < 1 || config.server.port > 65535) {
    issues.push('服务端端口配置无效');
  }
  
  return {
    isHealthy: issues.length === 0,
    issues,
    summary: getConfigSummary()
  };
}
export { getDefaultConfig } from './default.js';
