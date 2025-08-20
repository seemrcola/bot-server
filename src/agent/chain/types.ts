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
}

export interface IntentResult {
    mode: 'direct' | 'react'
    reason: string
}

export interface ChainStep {
    name: string
    execute: (context: ChainContext) => Promise<void> | AsyncIterable<string>
}
