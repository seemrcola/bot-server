/**
 * @file health.route.ts
 * @description 健康检查路由
 */

import { Router } from 'express'
import { getHealthStatus } from '../controllers/health.controller.js'

const healthRouter: Router = Router()

/**
 * @route GET /
 * @description 健康检查端点，用于验证服务是否正常运行。
 *              实际路径会是 /api/health，因为这个路由将在主 API 路由中被挂载。
 */
healthRouter.get('/', getHealthStatus)

export { healthRouter }
