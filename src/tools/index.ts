import { z } from 'zod';

/**
 * 定义并导出 Agent 可用的工具列表。
 * 每个工具都包含 name, definition, 和 handler。
 */

export const tools = [
  {
    name: 'getWeather',
    definition: {
      description: '获取指定地点的当前天气信息。',
      inputSchema: z.object({
        location: z.string().describe("要查询天气的地点，例如 '北京'"),
      }),
      outputSchema: z.object({
        weather: z.string().describe("地点对应的天气情况"),
      }),
    },
    handler: async (args: { location: string }) => {
      const { location } = args;
      const weathers = ['晴天', '多云', '小雨', '大雪', '雷阵雨'];
      const randomWeather = weathers[Math.floor(Math.random() * weathers.length)];
      return {
        content: [{
          type: 'text',
          text: `当前 ${location} 的天气是 ${randomWeather}`
        }],
        structuredContent: {
            weather: randomWeather
        }
      };
    }
  }
];
