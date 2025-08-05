/**
 * 统一导出所有类型定义
 */

// Agent and Tool-related types (now consolidated)
export type {
  IMCPAgent,
  MCPResponse,
  ChatContext,
  Plan,
  INLProcessor,
  AnalysisResult,
  MCPAgentConfig,
  ITool,
  ToolResult,
  ToolParameters,
  ToolInfo,
  ToolConfig,
  ToolParameterSchema,
  ToolsConfig,
  MCPMessage,
} from './agent.types.js';

export {
  MCPMessageType,
  MessageProcessor,
} from './agent.types.js';

// Client types
export type { IMCPClient, MCPClientConfig } from './client.types.js';

// Server types
export type { IMCPServer, MCPServerConfig } from './server.types.js';

// Config types
export type {
  LoggingConfig,
  MCPConfig,
  ConfigValidationResult,
  ConfigUpdateEvent,
} from './config.types.js';

// NLP types
export type { NLPConfig } from './nlp.types.js';

// LLM types
export type {
  LLMConfig,
  ILLMService,
  LLMMetrics,
  IntentAnalysisResult,
  ParameterExtractionResult,
  EnhancedAnalysisResult,
} from './llm.types.js';

// Intent types
export type {
  TaskType,
  TaskPriority,
  SubTask,
  IntentAnalysisResult as NewIntentAnalysisResult,
  TaskExecutionResult,
  HybridProcessingResult,
  IntentAnalyzerConfig,
  TaskExecutorConfig,
} from './intent.types.js';

// Prompt types
export type {
  PromptKey,
  PromptCollection,
  IPromptManager,
} from './prompts.types.js';

// Resource types
export type {
  ResourceURI,
  IResourceProvider,
  IResourceManager,
} from './resources.types.js';
