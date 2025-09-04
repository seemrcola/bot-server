/**
 * 用户数据结构
 * @description 代表数据库中 `users` 表的一行记录
 */
export interface User {
    id: string
    username: string
    email: string
    password_hash: string
    created_at: Date
    updated_at: Date
}
