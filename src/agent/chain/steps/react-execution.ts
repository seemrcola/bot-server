import { createLogger } from '../../utils/logger.js';
import { PromptReActExecutor } from '../../executors/promptBaseToolUse.ReAct.js';
import { FunctionReActExecutor } from '../../executors/functionCalling.ReAct.js';
import { config } from '../../../config/index.js';
import { ChainStep, ChainContext } from '../types.js';

const logger = createLogger('ReActExecutionStep');

/**
 * ReAct执行步骤
 */
export class ReActExecutionStep implements ChainStep {
  name = 'react_execution';

  async *execute(context: ChainContext): AsyncIterable<string> {
    logger.info('执行ReAct工具调用模式');
    
    const { maxSteps = 8, strategy = config.reactStrategy, temperature } = context.options;
    const reactResults: string[] = [];

    if (strategy === 'function') {
      logger.info('使用 FunctionReActExecutor 策略');
      const executor = new FunctionReActExecutor({ agent: context.agent });
      try {
        for await (const step of executor.run(context.messages, { maxSteps, temperature })) {
          reactResults.push(step);
          if (context.options.reactVerbose) {
            yield step + '\n';
          }
        }
      } catch (err) {
        logger.warn('FunctionReActExecutor 失败，回退到 PromptReActExecutor', err);
        const promptExecutor = new PromptReActExecutor({ agent: context.agent });
        for await (const step of promptExecutor.run(context.messages, { maxSteps, temperature })) {
          reactResults.push(step);
          if (context.options.reactVerbose) {
            yield step + '\n';
          }
        }
      }
    } else {
      logger.info('使用 PromptReActExecutor 策略');
      const executor = new PromptReActExecutor({ agent: context.agent });
      for await (const step of executor.run(context.messages, { maxSteps, temperature })) {
        reactResults.push(step);
        if (context.options.reactVerbose) {
          yield step + '\n';
        }
      }
    }

    context.reactResults = reactResults;
  }
} 
