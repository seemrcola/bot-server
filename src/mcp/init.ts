/**
 * MCP模块初始化
 * 这个文件负责在应用程序启动时初始化MCP模块
 */

import { getConfig, getConfigSummary, getConfigCenter, validateConfig } from './config/index.js';
import { createMCPLogger } from './utils/logger.js';

const logger = createMCPLogger('Init');

/**
 * 初始化MCP模块
 * 应该在应用程序启动时调用
 */
export function initializeMCP(): void {
  try {
    logger.info('初始化MCP模块');
    
    // 初始化配置中心
    const configCenter = getConfigCenter();
    logger.info('配置中心已初始化');
    
    // 验证配置
    const currentConfig = configCenter.getConfig();
    const validation = validateConfig(currentConfig);
    if (!validation.isValid) {
      logger.warn('配置验证发现问题', { 
        errors: validation.errors,
        warnings: validation.warnings 
      });
    }
    
    // 记录配置摘要
    const summary = getConfigSummary();
    logger.info('MCP模块初始化完成', summary);
    
  } catch (error) {
    logger.error('MCP模块初始化失败', error);
    throw error;
  }
}

/**
 * 检查MCP模块是否已正确配置
 */
export function checkMCPConfiguration(): {
  isValid: boolean;
  issues: string[];
  summary: {
    mcpEnabled: boolean;
    serverPort: number;
    hasHelloTool: boolean;
    logLevel: string;
  };
} {
  // 使用配置中心的验证功能
  const config = getConfig();
  const validation = validateConfig(config);
  
  const summary = {
    mcpEnabled: config.enabled,
    serverPort: config.server.port,
    hasHelloTool: false, // 暂时设为 false，因为没有 hello 工具
    hasJoJoTool: !!config.tools['jojo']?.enabled,
    logLevel: config.logging.level
  };
  
  // 合并错误和警告作为问题列表
  const issues = [...validation.errors, ...validation.warnings];
  
  return {
    isValid: validation.isValid,
    issues,
    summary
  };
}