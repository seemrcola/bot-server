/**
 * Markdown渲染模块
 * 负责加载和配置Markdown相关库，提供渲染功能
 */

import { CDN_CONFIG, MARKDOWN_CONFIG } from '../utils/constants.js'

class MarkdownRenderer {
    constructor() {
        this.isInitialized = false
        this.libraryStatus = {
            marked: false,
            highlight: false,
            katex: false,
            mermaid: false,
        }
        this.renderer = null
        this.initPromise = null
    }

    /**
     * 初始化Markdown渲染器
     * @returns {Promise<boolean>}
     */
    async init() {
        if (this.initPromise) {
            return this.initPromise
        }

        this.initPromise = this._performInit()
        return this.initPromise
    }

    /**
     * 执行初始化
     * @private
     */
    async _performInit() {
        try {
            console.log('[Markdown] 开始初始化渲染器...')

            // 检查已加载的库
            this._checkLibraries()

            // 加载缺失的库
            await this._loadMissingLibraries()

            // 配置渲染器
            this._setupRenderer()

            this.isInitialized = true
            console.log('[Markdown] 渲染器初始化完成')

            return true
        }
        catch (error) {
            console.error('[Markdown] 渲染器初始化失败:', error)
            return false
        }
    }

    /**
     * 检查库加载状态
     * @private
     */
    _checkLibraries() {
        this.libraryStatus.marked = typeof window.marked !== 'undefined'
        this.libraryStatus.highlight = typeof window.hljs !== 'undefined'
        this.libraryStatus.katex = typeof window.katex !== 'undefined'
        this.libraryStatus.mermaid = typeof window.mermaid !== 'undefined'

        console.log('[Markdown] 库加载状态:', this.libraryStatus)
    }

    /**
     * 加载缺失的库
     * @private
     */
    async _loadMissingLibraries() {
        const loadPromises = []

        Object.keys(this.libraryStatus).forEach((name) => {
            if (!this.libraryStatus[name]) {
                loadPromises.push(this._loadLibrary(name))
            }
        })

        if (loadPromises.length > 0) {
            console.log('[Markdown] 正在加载缺失的库...')
            await Promise.allSettled(loadPromises)
        }
    }

    /**
     * 加载单个库
     * @param {string} name - 库名称
     * @private
     */
    async _loadLibrary(name) {
        const primaryUrl = CDN_CONFIG.primary[name]
        const backupUrl = CDN_CONFIG.backup[name]

        try {
            await this._loadScript(primaryUrl)
            this.libraryStatus[name] = true
            console.log(`[Markdown] ${name} 主CDN加载成功`)
        }
        catch (error) {
            console.warn(`[Markdown] ${name} 主CDN加载失败，尝试备用CDN...`)

            try {
                await this._loadScript(backupUrl)
                this.libraryStatus[name] = true
                console.log(`[Markdown] ${name} 备用CDN加载成功`)
            }
            catch (backupError) {
                console.error(`[Markdown] ${name} 所有CDN加载失败`)
            }
        }
    }

    /**
     * 动态加载脚本
     * @param {string} url - 脚本URL
     * @private
     */
    _loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = url
            script.onload = resolve
            script.onerror = reject
            document.head.appendChild(script)
        })
    }

    /**
     * 配置渲染器
     * @private
     */
    _setupRenderer() {
        if (typeof window.marked === 'undefined') {
            console.warn('[Markdown] marked库未加载，使用纯文本显示')
            return
        }

        try {
            // 配置highlight.js
            if (window.hljs) {
                window.hljs.configure({
                    languages: MARKDOWN_CONFIG.languages,
                })
            }

            // 创建自定义渲染器
            const renderer = new window.marked.Renderer()

            // 自定义代码块渲染
            renderer.code = (code, language) => {
                // Mermaid图表处理
                if (language === 'mermaid') {
                    const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`

                    // 延迟渲染Mermaid图表
                    setTimeout(() => {
                        if (window.mermaid) {
                            this._renderMermaid(id, code)
                        }
                    }, 100)

                    return `<div id="${id}" class="mermaid">${code}</div>`
                }

                // 普通代码高亮
                if (window.hljs && language) {
                    try {
                        const highlighted = window.hljs.highlight(code, { language }).value
                        return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`
                    }
                    catch (e) {
                        console.warn(`[Markdown] 代码高亮失败:`, e)
                    }
                }

                return `<pre><code>${window.marked.parseInline(code)}</code></pre>`
            }

            // 配置marked选项
            window.marked.setOptions({
                renderer,
                ...MARKDOWN_CONFIG.marked,
            })

            // 初始化Mermaid
            if (window.mermaid) {
                window.mermaid.initialize(MARKDOWN_CONFIG.mermaid)
            }

            this.renderer = window.marked
            console.log('[Markdown] 渲染器配置完成')
        }
        catch (error) {
            console.error('[Markdown] 渲染器配置失败:', error)
        }
    }

    /**
     * 渲染Mermaid图表
     * @param {string} id - 元素ID
     * @param {string} code - Mermaid代码
     * @private
     */
    async _renderMermaid(id, code) {
        try {
            const { svg } = await window.mermaid.render(`${id}-svg`, code)
            const element = document.getElementById(id)
            if (element) {
                element.innerHTML = svg
            }
        }
        catch (error) {
            console.warn('[Markdown] Mermaid渲染失败:', error)
            const element = document.getElementById(id)
            if (element) {
                element.innerHTML = `<pre><code>${code}</code></pre>`
            }
        }
    }

    /**
     * 渲染Markdown内容
     * @param {string} content - Markdown内容
     * @returns {string} 渲染后的HTML
     */
    render(content) {
        if (!this.renderer) {
            return this._escapeHtml(content) // 降级到纯文本
        }

        try {
            let html = this.renderer.parse(content)

            // 处理KaTeX数学公式
            if (window.katex) {
                html = this._renderMath(html)
            }

            return html
        }
        catch (error) {
            console.error('[Markdown] 渲染失败:', error)
            return this._escapeHtml(content) // 降级到纯文本
        }
    }

    /**
     * 渲染数学公式
     * @param {string} html - HTML内容
     * @returns {string} 处理后的HTML
     * @private
     */
    _renderMath(html) {
        try {
            // 块级公式 $$...$$
            html = html.replace(/\$\$([^$]+)\$\$/g, (match, formula) => {
                try {
                    return window.katex.renderToString(formula.trim(), {
                        displayMode: true,
                        throwOnError: false,
                    })
                }
                catch (e) {
                    console.warn('[Markdown] KaTeX块级公式渲染失败:', e)
                    return match
                }
            })

            // 行内公式 $...$
            html = html.replace(/\$([^$]+)\$/g, (match, formula) => {
                try {
                    return window.katex.renderToString(formula.trim(), {
                        displayMode: false,
                        throwOnError: false,
                    })
                }
                catch (e) {
                    console.warn('[Markdown] KaTeX行内公式渲染失败:', e)
                    return match
                }
            })
        }
        catch (error) {
            console.error('[Markdown] 数学公式处理失败:', error)
        }

        return html
    }

    /**
     * HTML转义
     * @param {string} text - 要转义的文本
     * @returns {string} 转义后的文本
     * @private
     */
    _escapeHtml(text) {
        const div = document.createElement('div')
        div.textContent = text
        return div.innerHTML
    }

    /**
     * 获取库状态
     * @returns {object}
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            libraries: { ...this.libraryStatus },
        }
    }

    /**
     * 重新初始化
     * @returns {Promise<boolean>}
     */
    async reinit() {
        this.isInitialized = false
        this.initPromise = null
        this.renderer = null

        Object.keys(this.libraryStatus).forEach((key) => {
            this.libraryStatus[key] = false
        })

        return this.init()
    }
}

// 创建单例实例
const markdownRenderer = new MarkdownRenderer()

export default markdownRenderer
