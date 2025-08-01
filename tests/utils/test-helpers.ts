/**
 * 测试辅助工具
 * 提供通用的测试工具函数和模拟对象
 */

import { MCPAgent } from '../../src/mcp/agent/mcp-agent.js';
import { createLogger } from '../../src/utils/logger.js';

const logger = createLogger('TestHelpers');

/**
 * 获取可用端口
 */
export async function getAvailablePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

/**
 * 创建测试用的MCP Agent配置
 */
export function createTestMCPConfig() {
  return {
    enabled: true,
    llm: {
      apiKey: process.env.LLM_API_KEY || 'test-api-key',
      model: process.env.LLM_MODEL || 'deepseek-chat',
      configuration: {
        baseURL: process.env.LLM_BASE_URL || 'https://api.deepseek.com'
      }
    },
    client: {
      reconnectDelay: 1000
    },
    nlp: {
      confidenceThreshold: 0.6,
      maxRetries: 2
    },
    // 使用测试模式，避免启动真实服务器
    testMode: true
  };
}

/**
 * 创建测试用的MCP Agent实例
 */
export async function createTestMCPAgent(): Promise<MCPAgent> {
  const config = createTestMCPConfig();
  const agent = new MCPAgent(config);
  await agent.initialize();
  return agent;
}

/**
 * 清理测试用的MCP Agent
 */
export async function cleanupTestMCPAgent(agent: MCPAgent): Promise<void> {
  try {
    await agent.shutdown();
  } catch (error) {
    logger.warn('清理测试Agent时出现错误:', error);
  }
}

/**
 * 模拟LLM响应
 */
export function createMockLLMResponse(subTasks: any[], overallType: string = 'hybrid', confidence: number = 0.9) {
  return JSON.stringify({
    subTasks,
    overallType,
    confidence
  });
}

/**
 * 创建测试用的子任务
 */
export function createTestSubTask(
  id: string,
  content: string,
  type: 'simple_chat' | 'tool_call' | 'hybrid' = 'simple_chat',
  needsTool: boolean = false,
  suggestedTools: string[] = []
) {
  return {
    id,
    content,
    type,
    needsTool,
    suggestedTools,
    priority: 2,
    order: 1,
    canParallel: false,
    expectedOutputType: 'text'
  };
}

/**
 * 测试用例数据
 */
export const TEST_CASES = {
  // 简单对话测试用例
  SIMPLE_CHAT: [
    {
      name: '简单问候',
      message: '你好',
      expectedType: 'simple_chat',
      expectedTaskCount: 1
    },
    {
      name: '代码请求',
      message: '给我写一个JavaScript函数来计算斐波那契数列',
      expectedType: 'simple_chat',
      expectedTaskCount: 1
    }
  ],

  // 工具调用测试用例
  TOOL_CALL: [
    {
      name: 'JoJo工具调用',
      message: 'jojo',
      expectedType: 'tool_call',
      expectedTaskCount: 1,
      expectedTools: ['jojo']
    }
  ],

  // 混合任务测试用例
  HYBRID: [
    {
      name: '混合请求：代码+工具',
      message: '给我一段js代码，然后给我一个jojo工具的回复',
      expectedType: 'hybrid',
      expectedTaskCount: 2,
      expectedTools: ['jojo']
    },
    {
      name: '混合请求：问候+工具',
      message: '你好，然后调用jojo工具',
      expectedType: 'hybrid',
      expectedTaskCount: 2,
      expectedTools: ['jojo']
    }
  ]
};

/**
 * 等待指定时间
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 检查响应质量
 */
export function checkResponseQuality(response: string, originalMessage: string): {
  hasRepetition: boolean;
  isEmpty: boolean;
  isValid: boolean;
} {
  const hasRepetition = response.includes(originalMessage);
  const isEmpty = !response || response.trim().length === 0;
  const isValid = !isEmpty && !hasRepetition;

  return {
    hasRepetition,
    isEmpty,
    isValid
  };
}

/**
 * 模拟工具响应
 */
export const MOCK_TOOL_RESPONSES = {
  jojo: 'ゴゴゴゴゴ...',
  weather: '今天北京天气晴朗，温度25°C',
  search: '搜索结果：找到相关信息'
};

/**
 * 测试超时配置
 */
export const TEST_TIMEOUTS = {
  UNIT: 5000,      // 5秒
  INTEGRATION: 15000, // 15秒
  E2E: 30000       // 30秒
};

/**
 * 验证意图分析结果
 */
export function validateIntentAnalysisResult(result: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!result) {
    errors.push('结果为空');
    return { isValid: false, errors };
  }

  if (!Array.isArray(result.subTasks)) {
    errors.push('subTasks不是数组');
  }

  if (typeof result.overallType !== 'string') {
    errors.push('overallType不是字符串');
  }

  if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
    errors.push('confidence不是有效的数字(0-1)');
  }

  // 验证子任务结构
  if (Array.isArray(result.subTasks)) {
    result.subTasks.forEach((task: any, index: number) => {
      if (!task.id) {
        errors.push(`任务${index + 1}缺少id`);
      }
      if (!task.content) {
        errors.push(`任务${index + 1}缺少content`);
      }
      if (!['simple_chat', 'tool_call', 'hybrid'].includes(task.type)) {
        errors.push(`任务${index + 1}的type无效`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
