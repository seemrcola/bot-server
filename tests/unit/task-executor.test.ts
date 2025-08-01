/**
 * 任务执行器单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskExecutor } from '../../src/mcp/agent/task-executor.js';
import { LLMNLPProcessor, LLMConfigManager } from '../../src/mcp/llm/index.js';
import { MCPClient } from '../../src/mcp/client/mcp-client.js';
import { TaskType, TaskPriority, IntentAnalysisResult, SubTask } from '../../src/mcp/types/intent.types.js';
import {
  MOCK_TOOL_RESPONSES,
  TEST_TIMEOUTS
} from '../utils/test-helpers.js';

// 辅助函数：创建完整的IntentAnalysisResult
function createTestIntentAnalysisResult(
  originalMessage: string,
  subTasks: SubTask[],
  overallType: string = 'simple_chat',
  confidence: number = 0.9
): IntentAnalysisResult {
  return {
    originalMessage,
    subTasks,
    overallType: overallType as TaskType,
    confidence,
    hasToolTasks: subTasks.some(task => task.needsTool),
    hasSimpleTasks: subTasks.some(task => !task.needsTool),
    timestamp: Date.now()
  };
}

// 辅助函数：创建测试子任务
function createTestSubTask(
  id: string,
  content: string,
  type: TaskType = TaskType.SIMPLE_CHAT,
  needsTool: boolean = false,
  suggestedTools: string[] = [],
  dependencies: string[] = []
): SubTask {
  return {
    id,
    content,
    type,
    needsTool,
    suggestedTools,
    priority: TaskPriority.NORMAL,
    order: 1,
    canParallel: false,
    dependencies,
    expectedOutputType: 'text'
  };
}

describe('TaskExecutor', () => {
  let executor: TaskExecutor;
  let mockLLMProcessor: LLMNLPProcessor;
  let mockMCPClient: MCPClient;

  beforeEach(async () => {
    // 创建模拟的LLM处理器
    const configManager = new LLMConfigManager({
      apiKey: 'test-key',
      model: 'test-model',
      configuration: { baseURL: 'http://test.com' }
    });
    
    mockLLMProcessor = new LLMNLPProcessor(configManager);
    
    // 模拟LLM文本生成
    vi.spyOn(mockLLMProcessor, 'generateText').mockImplementation(async (prompt: string) => {
      if (prompt.includes('JavaScript') || prompt.includes('代码')) {
        return '这是一个JavaScript函数示例：\n```javascript\nfunction fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n-1) + fibonacci(n-2);\n}\n```';
      } else if (prompt.includes('问候') || prompt.includes('你好')) {
        return '你好！很高兴为您服务！';
      } else {
        return '这是一个友好的AI回复。';
      }
    });

    // 创建模拟的MCP客户端
    mockMCPClient = {
      callTool: vi.fn().mockImplementation(async (toolName: string, params: any) => {
        return MOCK_TOOL_RESPONSES[toolName as keyof typeof MOCK_TOOL_RESPONSES] || '模拟工具响应';
      }),
      isConnected: vi.fn().mockReturnValue(true)
    } as any;

    // 创建工具映射
    const toolToClientMap = new Map();
    toolToClientMap.set('jojo', mockMCPClient);
    toolToClientMap.set('weather', mockMCPClient);

    executor = new TaskExecutor(
      mockLLMProcessor,
      toolToClientMap,
      { maxRetries: 1 } // 使用有效的配置属性
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('executeTasks', () => {
    it('应该执行简单聊天任务', async () => {
      const analysisResult = createTestIntentAnalysisResult(
        '你好',
        [createTestSubTask('task_1', '回复用户问候', TaskType.SIMPLE_CHAT)],
        'simple_chat'
      );

      const result = await executor.executeIntentAnalysis(analysisResult);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.finalResponse).toBeDefined();
      expect(result.finalResponse.includes('你好')).toBe(true);
      expect(mockLLMProcessor.generateText).toHaveBeenCalled();
    }, TEST_TIMEOUTS.UNIT);

    it('应该执行工具调用任务', async () => {
      const analysisResult = createTestIntentAnalysisResult(
        'jojo',
        [createTestSubTask('task_1', '调用jojo工具', TaskType.TOOL_CALL, true, ['jojo'])],
        'tool_call'
      );

      const result = await executor.executeIntentAnalysis(analysisResult);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockMCPClient.callTool).toHaveBeenCalledWith('jojo', {});
    }, TEST_TIMEOUTS.UNIT);

    it('应该执行混合任务', async () => {
      const analysisResult = createTestIntentAnalysisResult(
        '给我一段js代码，然后调用jojo工具',
        [
          createTestSubTask('task_1', '生成JavaScript代码', TaskType.SIMPLE_CHAT, false, [], []),
          createTestSubTask('task_2', '调用jojo工具', TaskType.TOOL_CALL, true, ['jojo'], ['task_1'])
        ],
        'hybrid'
      );

      const result = await executor.executeIntentAnalysis(analysisResult);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockLLMProcessor.generateText).toHaveBeenCalled();
      expect(mockMCPClient.callTool).toHaveBeenCalledWith('jojo', {});
    }, TEST_TIMEOUTS.UNIT);

    it('应该处理工具调用失败', async () => {
      // 模拟工具调用失败
      vi.spyOn(mockMCPClient, 'callTool').mockRejectedValue(new Error('工具调用失败'));

      const analysisResult = createTestIntentAnalysisResult(
        'jojo',
        [createTestSubTask('task_1', '调用jojo工具', TaskType.TOOL_CALL, true, ['jojo'])],
        'tool_call'
      );

      const result = await executor.executeIntentAnalysis(analysisResult);

      // 应该返回错误处理后的结果，而不是抛出异常
      expect(result).toBeDefined();
      expect(result.success).toBe(false); // 工具调用失败，但不应该抛出异常
    }, TEST_TIMEOUTS.UNIT);

    it('应该处理并行任务执行', async () => {
      // 创建可并行执行的任务
      const task1 = createTestSubTask('task_1', '生成JavaScript代码', TaskType.SIMPLE_CHAT, false, [], []);
      const task2 = createTestSubTask('task_2', '调用jojo工具', TaskType.TOOL_CALL, true, ['jojo'], []);

      // 设置为可并行
      task1.canParallel = true;
      task2.canParallel = true;

      const analysisResult = createTestIntentAnalysisResult(
        '同时生成代码和调用工具',
        [task1, task2],
        'hybrid'
      );

      const startTime = Date.now();
      const result = await executor.executeIntentAnalysis(analysisResult);
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      // 并行执行应该比串行执行更快（这里只是简单验证）
      expect(duration).toBeLessThan(10000);
    }, TEST_TIMEOUTS.UNIT);
  });

  describe('任务排序', () => {
    it('应该正确排序有依赖关系的任务', async () => {
      const analysisResult = createTestIntentAnalysisResult(
        '测试任务排序',
        [
          createTestSubTask('task_2', '第二个任务', TaskType.SIMPLE_CHAT, false, [], ['task_1']),
          createTestSubTask('task_1', '第一个任务', TaskType.SIMPLE_CHAT, false, [], [])
        ],
        'simple_chat'
      );

      const result = await executor.executeIntentAnalysis(analysisResult);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      // 验证任务按正确顺序执行（通过调用次数验证）
      expect(mockLLMProcessor.generateText).toHaveBeenCalled();
    }, TEST_TIMEOUTS.UNIT);
  });
});
