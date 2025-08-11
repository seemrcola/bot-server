import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createLogger } from '../../utils/logger.js';
import { extractText } from '../../executors/utils.js';
import { ChainStep, ChainContext, IntentResult } from '../types.js';

const logger = createLogger('IntentAnalysisStep');

/**
 * 意图分析步骤
 */
export class IntentAnalysisStep implements ChainStep {
  name = 'intent_analysis';

  async execute(context: ChainContext): Promise<void> {
    logger.info('开始意图分析');
    
    const tools = await context.agent.listTools();
    const toolCatalog = tools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
    }));

    const intentMessages: BaseMessage[] = [
      new SystemMessage([
        context.agent.systemPromptValue,
        '你是意图分析器。任务：判断用户是否需要使用外部工具才能得到高质量答案。',
        '仅输出一个 JSON 对象，不要额外文本或代码块。',
        '{',
        '  "use_tools": true | false,',
        '  "reason": "简要说明判断依据"',
        '}',
        '判断依据：',
        '- 当与我们所提供的工具目录存在吻合度较高的描述时，请认为需要工具；',
        '- 当与工具目录描述不存在较高吻合度时，请认为不需要工具。',
      ].join('\n')),
      new HumanMessage([
        '用户最后一条消息：',
        JSON.stringify(context.messages[context.messages.length - 1] ? context.messages[context.messages.length - 1] : {}),
        '\n\n可用工具列表：',
        JSON.stringify(toolCatalog),
        '\n\n请输出判断 JSON：',
      ].join('')),
    ];

    try {
      const result = await context.agent.languageModel.invoke(intentMessages);
      const text = extractText(result?.content);
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      const slice = start >= 0 && end >= start ? text.slice(start, end + 1) : text;
      const parsed = JSON.parse(slice);
      
      context.intentResult = {
        mode: parsed?.use_tools ? 'react' : 'direct',
        reason: parsed?.reason || '未提供原因'
      };
      
      logger.info(`意图分析结果：${context.intentResult.mode}模式 - ${context.intentResult.reason}`);
    } catch (error) {
      logger.warn('意图分析失败，回退到直接回答模式', error);
      context.intentResult = { mode: 'direct', reason: '意图分析失败，回退到直接回答' };
    }
  }
} 
