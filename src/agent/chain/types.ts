import type { BaseMessage } from '@langchain/core/messages'
import type { Agent } from '../agent.js'

export interface ChainContext {
    messages: BaseMessage[]
    agent: Agent
    options: ChainOptions
    intentResult?: IntentResult
    reactResults?: string[]
    finalAnswer?: string
}

export interface ChainOptions {
    maxSteps?: number
    reactVerbose?: boolean
    temperature?: number
    /**
     * ReAct 恢复时注入的历史步骤
     */
    reactInitialSteps?: any[]
}

export interface IntentResult {
    mode: 'direct' | 'react'
    reason: string
}

export interface ChainStep {
    name: string
    execute: (context: ChainContext) => Promise<void> | AsyncIterable<string>
}
