import { Router } from 'express'
import { handleRegister } from '../controllers/user.controller.js'
import { validate } from '../middlewares/validation.middleware.js'
import { registerSchema } from '../validators/user.validator.js'

const userRouter: Router = Router()

// 定义用户注册路由
// POST /users/register
// 在控制器处理之前，先使用校验中间件对请求体进行校验
userRouter.post(
    '/register',
    validate(registerSchema),
    handleRegister,
)

export { userRouter }
