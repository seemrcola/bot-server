/**
 * DOM操作工具函数
 */

/**
 * 获取DOM元素的简化函数
 * @param {string} selector - CSS选择器
 * @param {Element} context - 查找上下文，默认为document
 * @returns {Element|null}
 */
export function $(selector, context = document) {
    return context.querySelector(selector)
}

/**
 * 获取多个DOM元素
 * @param {string} selector - CSS选择器
 * @param {Element} context - 查找上下文，默认为document
 * @returns {NodeList}
 */
export function $$(selector, context = document) {
    return context.querySelectorAll(selector)
}

/**
 * 创建DOM元素
 * @param {string} tag - 标签名
 * @param {object} attrs - 属性对象
 * @param {string|Node|Array} children - 子元素
 * @returns {Element}
 */
export function createElement(tag, attrs = {}, children = null) {
    const element = document.createElement(tag)

    // 设置属性
    Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value
        }
        else if (key === 'dataset') {
            Object.entries(value).forEach(([dataKey, dataValue]) => {
                element.dataset[dataKey] = dataValue
            })
        }
        else if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.slice(2).toLowerCase(), value)
        }
        else {
            element.setAttribute(key, value)
        }
    })

    // 添加子元素
    if (children) {
        if (typeof children === 'string') {
            element.textContent = children
        }
        else if (children instanceof Node) {
            element.appendChild(children)
        }
        else if (Array.isArray(children)) {
            children.forEach((child) => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child))
                }
                else if (child instanceof Node) {
                    element.appendChild(child)
                }
            })
        }
    }

    return element
}

/**
 * 滚动到元素底部
 * @param {Element} element - 要滚动的元素
 * @param {boolean} smooth - 是否平滑滚动
 */
export function scrollToBottom(element, smooth = true) {
    if (smooth) {
        element.scrollTo({
            top: element.scrollHeight,
            behavior: 'smooth',
        })
    }
    else {
        element.scrollTop = element.scrollHeight
    }
}

/**
 * 显示/隐藏元素
 * @param {Element} element - 要操作的元素
 * @param {boolean} show - 是否显示
 */
export function toggleElement(element, show) {
    if (show) {
        element.classList.remove('hidden')
    }
    else {
        element.classList.add('hidden')
    }
}

/**
 * 添加CSS类
 * @param {Element} element - 要操作的元素
 * @param {string|Array} classes - 要添加的类名
 */
export function addClass(element, classes) {
    if (Array.isArray(classes)) {
        element.classList.add(...classes)
    }
    else {
        element.classList.add(classes)
    }
}

/**
 * 移除CSS类
 * @param {Element} element - 要操作的元素
 * @param {string|Array} classes - 要移除的类名
 */
export function removeClass(element, classes) {
    if (Array.isArray(classes)) {
        element.classList.remove(...classes)
    }
    else {
        element.classList.remove(classes)
    }
}

/**
 * 设置元素文本内容
 * @param {Element} element - 要操作的元素
 * @param {string} text - 文本内容
 */
export function setText(element, text) {
    element.textContent = text
}

/**
 * 设置元素HTML内容
 * @param {Element} element - 要操作的元素
 * @param {string} html - HTML内容
 */
export function setHTML(element, html) {
    element.innerHTML = html
}

/**
 * 清空元素内容
 * @param {Element} element - 要清空的元素
 */
export function clearElement(element) {
    element.innerHTML = ''
}
