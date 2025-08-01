/**
 * 意图分析器单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IntentAnalyzer } from '../../src/mcp/agent/intent-analyzer.js';
import { LLMNLPProcessor, LLMConfigManager } from '../../src/mcp/llm/index.js';
import { 
  createMockLLMResponse, 
  createTestSubTask, 
  TEST_CASES,
  validateIntentAnalysisResult,
  TEST_TIMEOUTS
} from '../utils/test-helpers.js';

describe('IntentAnalyzer', () => {
  let analyzer: IntentAnalyzer;
  let mockLLMProcessor: LLMNLPProcessor;

  beforeEach(async () => {
    // 创建模拟的LLM处理器
    const configManager = new LLMConfigManager({
      apiKey: 'test-key',
      model: 'test-model',
      configuration: { baseURL: 'http://test.com' }
    });
    
    mockLLMProcessor = new LLMNLPProcessor(configManager);
    
    // 模拟generateText方法 - 根据用户消息内容返回不同的模拟响应
    vi.spyOn(mockLLMProcessor, 'generateText').mockImplementation(async (prompt: string) => {
      // 从提示词中提取用户消息 - 修正正则表达式以匹配实际格式
      const userMessageMatch = prompt.match(/用户消息：(.+?)(?:\n|$)/);
      const userMessage = userMessageMatch ? userMessageMatch[1].trim() : '';



      if (userMessage === 'jojo') {
        return createMockLLMResponse([
          createTestSubTask('task_1', '调用jojo工具', 'tool_call', true, ['jojo'])
        ], 'tool_call');
      } else if (userMessage === '你好') {
        return createMockLLMResponse([
          createTestSubTask('task_1', '简单问候回复', 'simple_chat', false)
        ], 'simple_chat');
      } else if (userMessage.includes('代码') && userMessage.includes('然后')) {
        return createMockLLMResponse([
          createTestSubTask('task_1', '生成JavaScript代码', 'simple_chat', false),
          createTestSubTask('task_2', '调用jojo工具', 'tool_call', true, ['jojo'])
        ], 'hybrid');
      } else if (userMessage.includes('代码')) {
        return createMockLLMResponse([
          createTestSubTask('task_1', '生成JavaScript代码', 'simple_chat', false)
        ], 'simple_chat');
      } else if (userMessage === '') {
        return createMockLLMResponse([
          createTestSubTask('task_1', '简单对话回复', 'simple_chat', false)
        ], 'simple_chat');
      } else {
        return createMockLLMResponse([
          createTestSubTask('task_1', '简单对话回复', 'simple_chat', false)
        ], 'simple_chat');
      }
    });

    analyzer = new IntentAnalyzer(mockLLMProcessor, ['jojo', 'weather', 'search']);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('analyzeIntent', () => {
    it('应该正确分析简单对话意图', async () => {
      const result = await analyzer.analyzeIntent('你好');

      expect(result).toBeDefined();
      expect(result.overallType).toBe('simple_chat');
      expect(result.subTasks).toHaveLength(1);
      expect(result.confidence).toBeGreaterThan(0);

      const validation = validateIntentAnalysisResult(result);
      expect(validation.isValid).toBe(true);
    }, TEST_TIMEOUTS.UNIT);

    it('应该正确分析工具调用意图', async () => {
      const result = await analyzer.analyzeIntent('jojo');

      expect(result).toBeDefined();
      expect(result.overallType).toBe('tool_call');
      expect(result.subTasks).toHaveLength(1);
      expect(result.hasToolTasks).toBe(true);

      const toolTask = result.subTasks.find(task => task.needsTool);
      expect(toolTask).toBeDefined();
      expect(toolTask?.suggestedTools).toContain('jojo');
    }, TEST_TIMEOUTS.UNIT);

    it('应该正确分析混合任务意图', async () => {
      const result = await analyzer.analyzeIntent('给我一段js代码，然后给我一个jojo工具的回复');

      expect(result).toBeDefined();
      expect(result.overallType).toBe('hybrid');
      expect(result.subTasks).toHaveLength(2);
      expect(result.hasToolTasks).toBe(true);
      expect(result.hasSimpleTasks).toBe(true);

      // 验证包含简单任务和工具任务
      const simpleTasks = result.subTasks.filter(task => !task.needsTool);
      const toolTasks = result.subTasks.filter(task => task.needsTool);

      expect(simpleTasks.length).toBeGreaterThan(0);
      expect(toolTasks.length).toBeGreaterThan(0);
    }, TEST_TIMEOUTS.UNIT);

    it('应该处理LLM响应解析错误', async () => {
      // 模拟无效的LLM响应
      vi.spyOn(mockLLMProcessor, 'generateText').mockResolvedValue('无效的JSON响应');

      const result = await analyzer.analyzeIntent('测试消息');

      // 应该返回降级结果
      expect(result).toBeDefined();
      expect(result.subTasks).toHaveLength(1);
      expect(result.subTasks[0].type).toBe('simple_chat');
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    }, TEST_TIMEOUTS.UNIT);

    it('应该正确设置可用工具', () => {
      const tools = ['jojo', 'weather', 'search'];
      const newAnalyzer = new IntentAnalyzer(mockLLMProcessor, tools);
      
      // 通过分析结果验证工具设置
      expect(newAnalyzer).toBeDefined();
    });
  });

  describe('parseLLMResponse', () => {
    it('应该正确解析有效的JSON响应', async () => {
      const result = await analyzer.analyzeIntent('测试');

      expect(result.subTasks).toHaveLength(1);
      expect(result.subTasks[0].id).toBe('task_1');
      expect(result.subTasks[0].content).toBe('简单对话回复'); // 修正期望值
    });

    it('应该处理缺少字段的响应', async () => {
      // 模拟不完整的响应
      vi.spyOn(mockLLMProcessor, 'generateText').mockResolvedValue(
        JSON.stringify({
          subTasks: [{ content: '测试' }], // 缺少必要字段
          overallType: 'simple_chat'
          // 缺少confidence
        })
      );

      const result = await analyzer.analyzeIntent('测试');
      
      expect(result).toBeDefined();
      expect(result.subTasks[0].id).toBeDefined(); // 应该自动生成ID
      expect(result.confidence).toBeDefined(); // 应该有默认值
    });
  });

  describe('错误处理', () => {
    it('应该处理LLM调用失败', async () => {
      vi.spyOn(mockLLMProcessor, 'generateText').mockRejectedValue(new Error('LLM调用失败'));

      const result = await analyzer.analyzeIntent('测试消息');

      // 应该返回降级结果而不是抛出错误
      expect(result).toBeDefined();
      expect(result.subTasks).toHaveLength(1);
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });

    it('应该处理空消息', async () => {
      const result = await analyzer.analyzeIntent('');

      expect(result).toBeDefined();
      expect(result.subTasks).toHaveLength(1);
      expect(result.overallType).toBe('simple_chat');
    });
  });
});
