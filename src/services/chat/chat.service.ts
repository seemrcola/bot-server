import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createLogger } from '../../utils/logger.js';
import { globals } from '../../globals.js'; // 从全局容器导入
import { PromptReActExecutor, FunctionReActExecutor } from '../../agent/index.js';
import { config, type AppConfig } from '../../config/index.js';
import { extractText } from '../../agent/executors/utils.js';

const logger = createLogger('ChatService');

class ChatService {
  /**
   * 基于意图分析的流式聊天：
   * 1) 先用 LLM 判断是否需要使用工具（ReAct 模式）
   * 2) 若需要，进入 ReAct 流程；否则进行直接回答（Markdown，流式输出）
   */
  public async runStreamWithIntent(
    messages: BaseMessage[],
    options: { maxSteps: number; agentName: string; strategy?: AppConfig['reactStrategy'] }
  ): Promise<{ mode: 'react' | 'direct'; stream: AsyncIterable<string> }>
  {
    const agentName = options.agentName || 'main-agent';

    const agentManager = globals.agentManager;
    if (!agentManager) {
      logger.error("严重错误: AgentManager 未初始化！");
      throw new Error("AgentManager 尚未初始化，无法处理聊天请求。");
    }
    const agent = agentManager.getAgent(agentName);
    if (!agent) {
      logger.error(`未找到名为 ${agentName} 的 Agent！`);
      throw new Error(`未找到名为 ${agentName} 的 Agent。`);
    }

    // 等待Agent初始化完成
    await agent.ready;

    // 列举当前可用工具，供意图分析参考
    const tools = await agent.listTools();
    const toolCatalog = tools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: t.inputSchema ?? {},
    }));

    const decision = await analyzeIntentWithLLM(
      agent.languageModel,
      agent.systemPromptValue,
      messages,
      toolCatalog
    );

    if (decision === 'react') {
      const stream = await this.runReActStream(messages, options);
      return { mode: 'react', stream };
    }

    // 直接回答（Markdown），流式输出
    const stream = streamDirectMarkdownAnswer(
      agent.languageModel,
      agent.systemPromptValue,
      messages
    );
    return { mode: 'direct', stream };
  }

  /**
   * ReAct 模式：多步、多工具的流式聊天链。
   * 默认仅在最终答案时输出；如需步骤轨迹，请在控制器层处理。
   */
  public async runReActStream(
    messages: BaseMessage[],
    options: { maxSteps: number; agentName: string; strategy?: AppConfig['reactStrategy'] }
  ): Promise<AsyncIterable<string>> {
    const agentName = options.agentName || 'main-agent';

    const agentManager = globals.agentManager;
    if (!agentManager) {
      logger.error("严重错误: AgentManager 未初始化！");
      throw new Error("AgentManager 尚未初始化，无法处理聊天请求。");
    }
    const agent = agentManager.getAgent(agentName);
    if (!agent) {
      logger.error(`未找到名为 ${agentName} 的 Agent！`);
      throw new Error(`未找到名为 ${agentName} 的 Agent。`);
    }

    // 等待Agent初始化完成
    await agent.ready;

    const strategy = options.strategy || config.reactStrategy;
    if (strategy === 'function') {
      logger.info('使用 FunctionReActExecutor 策略');
      const executor = new FunctionReActExecutor({ agent });
      try {
        return executor.run(messages, { maxSteps: options.maxSteps });
      } catch (err) {
        logger.warn('FunctionReActExecutor 初始化失败，回退到 PromptReActExecutor', err);
        const promptExecutor = new PromptReActExecutor({ agent });
        return promptExecutor.run(messages, { maxSteps: options.maxSteps });
      }
    }
    if (strategy === 'prompt') {
      logger.info('使用 PromptReActExecutor 策略');
      const executor = new PromptReActExecutor({ agent });
      return executor.run(messages, { maxSteps: options.maxSteps });
    }
    throw new Error(`不支持的策略: ${strategy}`);
  }
}

async function analyzeIntentWithLLM(
  llm: any,
  systemPrompt: string,
  messages: BaseMessage[],
  toolCatalog: Array<{ name: string; description?: string; inputSchema?: unknown }>
): Promise<'react' | 'direct'> {
  const inspectMessages: BaseMessage[] = [
    new SystemMessage([
      systemPrompt,
      '你是意图分析器。任务：判断用户是否需要使用外部工具（如检索系统/文件/网络/接口等能力）才能得到高质量答案。',
      '仅输出一个 JSON 对象，不要额外文本或代码块。',
      '{',
      '  "use_tools": true | false,',
      '  "reason": "简要说明"',
      '}',
      '判断依据：',
      '- 当需要查询实时数据、调用接口、读取系统/文件/网络信息、执行复杂计算/转换等，请认为需要工具；',
      '- 当仅为知识性问答、总结、改写、翻译、头脑风暴、小段代码解释等，可直接回答（不使用工具）。',
    ].join('\n')),
    new HumanMessage([
      '用户最后一条消息：',
      JSON.stringify(messages[messages.length - 1] ?? {}),
      '\n\n可用工具列表（名称/描述）：',
      JSON.stringify(toolCatalog.map(t => ({ name: t.name, description: t.description }))),
      '\n\n请输出判断 JSON：',
    ].join('')),
  ];

  try {
    const result = await llm.invoke(inspectMessages);
    const text = extractText(result?.content);
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    const slice = start >= 0 && end >= start ? text.slice(start, end + 1) : text;
    const parsed = JSON.parse(slice);
    return parsed?.use_tools ? 'react' : 'direct';
  } catch {
    // 回退策略：若分析失败，优先走直接回答，避免卡住
    return 'direct';
  }
}

function streamDirectMarkdownAnswer(
  llm: any,
  systemPrompt: string,
  messages: BaseMessage[],
): AsyncIterable<string> {
  const mdMessages: BaseMessage[] = [
    new SystemMessage([
      systemPrompt,
      '如果不需要工具，请直接以 Markdown 输出高质量答案（不要解释使用了哪些工具）。',
    ].join('\n')),
    ...messages,
  ];

  const iterator = (async function* () {
    const stream = await llm.stream(mdMessages);
    for await (const chunk of stream) {
      const piece = extractText((chunk as any)?.content);
      if (piece) {
        yield piece;
      }
    }
  })();

  return iterator;
}

// 导出 ChatService 的单例
export const chatService = new ChatService();
