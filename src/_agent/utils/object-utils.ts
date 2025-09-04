/**
 * 对象工具函数
 * 提供通用的对象操作工具函数
 */

/**
 * 深度合并对象
 * @param target 目标对象
 * @param source 源对象
 * @returns 合并后的新对象
 */
export function deepMerge(target: any, source: any): any {
    const result = { ...target }

    for (const key in source) {
        const sourceValue = source[key]
        const targetValue = result[key]

        if (sourceValue !== undefined) {
            if (isObject(sourceValue) && isObject(targetValue)) {
                result[key] = deepMerge(targetValue, sourceValue)
            }
            else {
                result[key] = sourceValue
            }
        }
    }

    return result
}

/**
 * 检查是否为对象（非数组）
 * @param item 要检查的项目
 * @returns 是否为对象
 */
export function isObject(item: any): item is Record<string, any> {
    return item && typeof item === 'object' && !Array.isArray(item)
}

/**
 * 深度克隆对象
 * @param obj 要克隆的对象
 * @returns 克隆后的新对象
 */
export function deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj))
}

/**
 * 安全地获取嵌套对象属性
 * @param obj 对象
 * @param path 属性路径，如 'a.b.c'
 * @param defaultValue 默认值
 * @returns 属性值或默认值
 */
export function safeGet(obj: any, path: string, defaultValue?: any): any {
    const keys = path.split('.')
    let result = obj

    for (const key of keys) {
        if (result == null || typeof result !== 'object') {
            return defaultValue
        }
        result = result[key]
    }

    return result !== undefined ? result : defaultValue
}

/**
 * 安全地设置嵌套对象属性
 * @param obj 对象
 * @param path 属性路径，如 'a.b.c'
 * @param value 要设置的值
 */
export function safeSet(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    let current = obj

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i]
        if (!key)
            continue

        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {}
        }
        current = current[key]
    }

    const lastKey = keys[keys.length - 1]
    if (lastKey) {
        current[lastKey] = value
    }
}

/**
 * 过滤对象属性
 * @param obj 源对象
 * @param predicate 过滤函数
 * @returns 过滤后的新对象
 */
export function filterObject<T>(
    obj: Record<string, T>,
    predicate: (key: string, value: T) => boolean,
): Record<string, T> {
    const result: Record<string, T> = {}

    for (const [key, value] of Object.entries(obj)) {
        if (predicate(key, value)) {
            result[key] = value
        }
    }

    return result
}

/**
 * 映射对象属性
 * @param obj 源对象
 * @param mapper 映射函数
 * @returns 映射后的新对象
 */
export function mapObject<T, U>(
    obj: Record<string, T>,
    mapper: (key: string, value: T) => U,
): Record<string, U> {
    const result: Record<string, U> = {}

    for (const [key, value] of Object.entries(obj)) {
        result[key] = mapper(key, value)
    }

    return result
}

/**
 * 检查对象是否为空
 * @param obj 要检查的对象
 * @returns 是否为空
 */
export function isEmpty(obj: any): boolean {
    if (obj == null)
        return true
    if (Array.isArray(obj))
        return obj.length === 0
    if (typeof obj === 'object')
        return Object.keys(obj).length === 0
    return false
}

/**
 * 扁平化嵌套对象
 * @param obj 嵌套对象
 * @param prefix 前缀
 * @returns 扁平化后的对象
 */
export function flatten(obj: any, prefix = ''): Record<string, any> {
    const result: Record<string, any> = {}

    for (const key in obj) {
        const newKey = prefix ? `${prefix}.${key}` : key

        if (isObject(obj[key])) {
            Object.assign(result, flatten(obj[key], newKey))
        }
        else {
            result[newKey] = obj[key]
        }
    }

    return result
}
