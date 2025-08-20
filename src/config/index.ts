import process from 'node:process'

/**
 * 应用程序配置接口
 */
export interface AppConfig {
    port: number
    nodeEnv: string
    corsOrigin: string
}

/**
 * 应用程序配置对象
 * 从环境变量中读取配置，并提供默认值。
 */
export const config: AppConfig = {
    port: Number.parseInt(process.env['PORT'] || '3000', 10),
    nodeEnv: process.env['NODE_ENV'] || 'development',
    corsOrigin: process.env['CORS_ORIGIN'] || '*',
}
