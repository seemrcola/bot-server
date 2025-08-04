/**
 * @file system-prompts.ts
 * @description 系统提示词配置文件
 *              集中管理所有系统提示词的获取和格式化
 */

import { promptManager } from '../prompts/manager.js';

/**
 * 提示词模板替换函数
 */
function replacePromptTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value || '');
  }
  return result;
}

/**
 * 获取意图分析提示词
 */
export function getIntentAnalysisPrompt(userMessage: string, availableTools: Array<{name: string, description: string}>): string {
  const template = promptManager.getPrompt('intent_analysis');
  let toolsInfo = '';
  
  if (availableTools.length > 0) {
    toolsInfo = `\n\n## 可用工具\n${availableTools.map(tool => 
      `- **${tool.name}**: ${tool.description}`
    ).join('\n')}`;
  }
  
  return `${template}${toolsInfo}\n\n用户消息：${userMessage}`;
}

/**
 * 获取简单任务执行提示词
 */
export function getSimpleTaskPrompt(taskContent: string, taskType: string, contextInfo: string): string {
  const template = promptManager.getPrompt('simple_task');
  return replacePromptTemplate(template, {
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
  const template = promptManager.getPrompt('final_response');
  return replacePromptTemplate(template, {
    overallType,
    confidence: confidence.toString(),
    successCount: successResults.length.toString(),
    failedCount: failedResults.length.toString(),
    successResults: successResults.join('\n\n') || '无',
    failedResults: failedResults.join('\n\n') || '无'
  });
}

/**
 * 获取工具错误处理提示词
 */
export function getToolErrorPrompt(toolName: string, errorMessage: string): string {
  const template = promptManager.getPrompt('tool_error');
  return replacePromptTemplate(template, {
    toolName,
    errorMessage
  });
}
