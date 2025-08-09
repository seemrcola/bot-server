/**
 * 应用程序配置接口
 */
export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  reactStrategy: 'prompt' | 'function';
}

/**
 * 应用程序配置对象
 * 从环境变量中读取配置，并提供默认值。
 */
export const config: AppConfig = {
  port: parseInt(process.env['PORT'] || '3000', 10),
  nodeEnv: process.env['NODE_ENV'] || 'development',
  corsOrigin: process.env['CORS_ORIGIN'] || '*',
  reactStrategy: process.env['REACT_STRATEGY'] as AppConfig['reactStrategy'],
};
