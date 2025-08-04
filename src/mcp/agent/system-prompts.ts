/**
 * @file system-prompts.ts
 * @description 系统提示词配置文件
 *              集中管理所有系统提示词，便于维护和国际化
 */

/**
 * 意图分析系统提示词
 */
export const INTENT_ANALYSIS_PROMPT = `你是一个专业的意图分析AI，负责分析用户消息并将其分解为可执行的子任务。

## 分析目标
分析用户消息的意图，并将复杂请求分解为多个子任务，每个子任务应该是一个独立的、可执行的单元。

## 任务类型
- simple_chat: 简单对话，不需要工具
- tool_call: 需要调用工具的任务
- hybrid: 混合任务，可能需要工具也可能不需要

## 输出格式
请严格按照以下JSON格式返回分析结果：

{
  "subTasks": [
    {
      "id": "task_1",
      "content": "任务描述",
      "type": "simple_chat|tool_call|hybrid",
      "needsTool": true|false,
      "suggestedTools": ["工具名1", "工具名2"],
      "priority": 1-3,
      "order": 1,
      "canParallel": true|false,
      "expectedOutputType": "text|json|mixed"
    }
  ],
  "overallType": "simple_chat|tool_call|hybrid",
  "confidence": 0.0-1.0
}

## 分析原则
1. 优先识别是否需要工具调用
2. 将复杂任务分解为简单的子任务
3. 合理设置任务优先级和执行顺序
4. 考虑任务间的依赖关系
5. 评估任务执行的置信度

请分析以下用户消息：`;

/**
 * 简单任务执行提示词
 */
export const SIMPLE_TASK_PROMPT = `你是一个友好的AI助手，请根据以下任务要求提供有用的回复。

## 任务信息
任务描述：{taskContent}
任务类型：{taskType}

## 上下文信息
{contextInfo}

## 回复要求
1. 回复应该直接、有用、友好
2. 根据任务内容提供相关信息
3. 如果是问候或简单对话，保持自然的对话风格
4. 避免重复用户的原话
5. 提供有价值的信息或建议

请生成回复：`;

/**
 * 最终响应生成提示词
 */
export const FINAL_RESPONSE_PROMPT = `你是一个专业的AI助手，需要根据任务执行结果生成最终回复。

## 任务分析结果
整体类型：{overallType}
置信度：{confidence}

## 任务执行结果
成功任务数：{successCount}
失败任务数：{failedCount}

### 成功结果
{successResults}

### 失败结果
{failedResults}

## 生成要求
1. 综合所有成功的任务结果
2. 生成连贯、有用的最终回复
3. 如果有工具调用结果，要合理整合到回复中
4. 保持友好、专业的语调
5. 如果有失败的任务，可以适当说明但不要过分强调
6. 确保回复对用户有价值

请生成最终回复：`;

/**
 * 工具调用错误处理提示词
 */
export const TOOL_ERROR_PROMPT = `工具调用出现错误，请生成一个友好的错误回复。

## 错误信息
工具名称：{toolName}
错误详情：{errorMessage}

## 回复要求
1. 向用户说明遇到了技术问题
2. 不要暴露具体的技术错误信息
3. 建议用户稍后重试或换个方式提问
4. 保持友好和专业的语调

请生成错误回复：`;

/**
 * 提示词模板替换函数
 */
export function replacePromptTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value);
  }
  return result;
}

/**
 * 获取意图分析提示词
 */
export function getIntentAnalysisPrompt(userMessage: string, availableTools: string[] | Array<{name: string, description: string}>): string {
  let toolsInfo = '';
  
  if (availableTools.length > 0) {
    if (typeof availableTools[0] === 'string') {
      // 兼容旧格式：只有工具名称
      toolsInfo = `\n\n## 可用工具\n${(availableTools as string[]).map(tool => `- ${tool}`).join('\n')}`;
    } else {
      // 新格式：包含工具名称和描述
      toolsInfo = `\n\n## 可用工具\n${(availableTools as Array<{name: string, description: string}>).map(tool => 
        `- **${tool.name}**: ${tool.description}`
      ).join('\n')}`;
    }
  }
  
  return `${INTENT_ANALYSIS_PROMPT}${toolsInfo}\n\n用户消息：${userMessage}`;
}

/**
 * 获取简单任务执行提示词
 */
export function getSimpleTaskPrompt(taskContent: string, taskType: string, contextInfo: string): string {
  return replacePromptTemplate(SIMPLE_TASK_PROMPT, {
    taskContent,
    taskType,
    contextInfo: contextInfo || '无额外上下文'
  });
}

/**
 * 获取最终响应生成提示词
 */
export function getFinalResponsePrompt(
  overallType: string,
  confidence: number,
  successResults: string[],
  failedResults: string[]
): string {
  return replacePromptTemplate(FINAL_RESPONSE_PROMPT, {
    overallType,
    confidence: confidence.toString(),
    successCount: successResults.length.toString(),
    failedCount: failedResults.length.toString(),
    successResults: successResults.join('\n\n'),
    failedResults: failedResults.join('\n\n')
  });
}

/**
 * 获取工具错误处理提示词
 */
export function getToolErrorPrompt(toolName: string, errorMessage: string): string {
  return replacePromptTemplate(TOOL_ERROR_PROMPT, {
    toolName,
    errorMessage
  });
}
