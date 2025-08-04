/**
 * 配置模块入口
 * 统一导出 ConfigManager 和相关类型
 */
export { ConfigManager, configManager } from './manager.js';
export { DEFAULT_CONFIG as defaultConfig } from './default.js';
export { validateConfig } from './validator.js';
