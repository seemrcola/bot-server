// 导出主类
export { AgentChain } from './agent-chain.js';

// 导出类型
export type { 
  ChainContext, 
  ChainOptions, 
  IntentResult, 
  ChainStep 
} from './types.js';

// 导出步骤类（如果需要单独使用）
export {
  IntentAnalysisStep,
  DirectLLMStep,
  ReActExecutionStep,
  ResponseEnhancementStep
} from './steps/index.js'; 
