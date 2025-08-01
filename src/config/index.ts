/**
 * 应用程序配置
 */

export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
}

export const config: AppConfig = {
  port: parseInt(process.env['PORT'] || '3000', 10),
  nodeEnv: process.env['NODE_ENV'] || 'development',
  corsOrigin: process.env['CORS_ORIGIN'] || '*'
};