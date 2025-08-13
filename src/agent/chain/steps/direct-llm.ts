import { BaseMessage, SystemMessage } from "@langchain/core/messages";
import { createLogger } from '../../utils/logger.js';
import { extractText } from '../../executors/utils.js';
import { ChainStep, ChainContext } from '../types.js';

const logger = createLogger('DirectLLMStep');

/**
 * 直接LLM执行步骤
 */
export class DirectLLMStep implements ChainStep {
  name = 'direct_llm';

  async *execute(context: ChainContext): AsyncIterable<string> {
    logger.info('执行直接LLM回答模式');
    
    const mdMessages: BaseMessage[] = [
      new SystemMessage([
        context.agent.systemPromptValue,
        '请直接以 Markdown 格式输出高质量答案。',
      ].join('\n')),
      ...context.messages,
    ];

    // 若提供了温度，动态绑定模型参数
    const baseModel: any = context.agent.languageModel as any;
    const llmToUse: any = (typeof baseModel?.bind === 'function' && typeof context.options.temperature === 'number')
      ? baseModel.bind({ temperature: context.options.temperature })
      : baseModel;

    const stream = await llmToUse.stream(mdMessages);
    for await (const chunk of stream) {
      const piece = extractText((chunk as any)?.content);
      if (piece) {
        yield piece;
      }
    }
  }
} 
