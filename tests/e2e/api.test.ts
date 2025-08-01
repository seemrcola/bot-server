/**
 * API 端到端测试
 * 测试完整的HTTP API流程
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_TIMEOUTS, delay } from '../utils/test-helpers.js';

// 注意：这些测试需要实际的服务器运行
// 在CI/CD环境中，应该先启动测试服务器

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('API End-to-End Tests', () => {
  let serverProcess: any;

  beforeAll(async () => {
    // 在实际项目中，这里应该启动测试服务器
    // 或者确保测试服务器已经在运行
    console.log('准备E2E测试环境...');
    await delay(2000);
  }, TEST_TIMEOUTS.E2E);

  afterAll(async () => {
    // 清理测试环境
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  describe('Chat API', () => {
    it('应该处理简单的聊天请求', async () => {
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: '你好'
            }
          ]
        })
      });

      expect(response.ok).toBe(true);
      
      // 对于流式响应，我们需要读取流
      const reader = response.body?.getReader();
      expect(reader).toBeDefined();

      if (reader) {
        const chunks: string[] = [];
        let done = false;

        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          
          if (value) {
            const chunk = new TextDecoder().decode(value);
            chunks.push(chunk);
          }
        }

        const fullResponse = chunks.join('');
        expect(fullResponse.length).toBeGreaterThan(0);
        expect(fullResponse).toMatch(/你好|hello|hi/i);
      }
    }, TEST_TIMEOUTS.E2E);

    it('应该处理JoJo工具调用请求', async () => {
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'jojo'
            }
          ]
        })
      });

      expect(response.ok).toBe(true);

      const reader = response.body?.getReader();
      if (reader) {
        const chunks: string[] = [];
        let done = false;

        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          
          if (value) {
            const chunk = new TextDecoder().decode(value);
            chunks.push(chunk);
          }
        }

        const fullResponse = chunks.join('');
        expect(fullResponse).toMatch(/jojo|JoJo|ゴゴゴ|ロードローラー/i);
      }
    }, TEST_TIMEOUTS.E2E);

    it('应该处理混合任务请求', async () => {
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: '给我一段js代码，然后调用jojo工具'
            }
          ]
        })
      });

      expect(response.ok).toBe(true);

      const reader = response.body?.getReader();
      if (reader) {
        const chunks: string[] = [];
        let done = false;

        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          
          if (value) {
            const chunk = new TextDecoder().decode(value);
            chunks.push(chunk);
          }
        }

        const fullResponse = chunks.join('');
        expect(fullResponse).toMatch(/javascript|function|代码/i);
        expect(fullResponse).toMatch(/jojo|JoJo|ゴゴゴ/i);
      }
    }, TEST_TIMEOUTS.E2E);

    it('应该处理错误请求', async () => {
      // 测试无效的请求格式
      const response1 = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // 缺少messages字段
          invalid: 'data'
        })
      });

      expect(response1.status).toBeGreaterThanOrEqual(400);

      // 测试空消息
      const response2 = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: []
        })
      });

      expect(response2.status).toBeGreaterThanOrEqual(400);
    }, TEST_TIMEOUTS.E2E);
  });

  describe('Health Check', () => {
    it('应该返回健康状态', async () => {
      const response = await fetch(`${API_BASE_URL}/health`);
      
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toBeDefined();
      expect(data.status).toBe('ok');
    }, TEST_TIMEOUTS.E2E);
  });

  describe('Static Files', () => {
    it('应该提供静态文件服务', async () => {
      const response = await fetch(`${API_BASE_URL}/`);
      
      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toMatch(/text\/html/);
    }, TEST_TIMEOUTS.E2E);
  });

  describe('CORS', () => {
    it('应该支持CORS请求', async () => {
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3001',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        }
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get('access-control-allow-origin')).toBeDefined();
    }, TEST_TIMEOUTS.E2E);
  });

  describe('性能测试', () => {
    it('应该在合理时间内响应', async () => {
      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: '快速测试'
            }
          ]
        })
      });

      const duration = Date.now() - startTime;
      
      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(15000); // 应该在15秒内响应
    }, TEST_TIMEOUTS.E2E);

    it('应该支持并发请求', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => 
        fetch(`${API_BASE_URL}/api/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: `并发测试 ${i + 1}`
              }
            ]
          })
        })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      responses.forEach(response => {
        expect(response.ok).toBe(true);
      });

      // 并发请求应该比串行请求更快
      expect(duration).toBeLessThan(30000);
    }, TEST_TIMEOUTS.E2E);
  });
});
