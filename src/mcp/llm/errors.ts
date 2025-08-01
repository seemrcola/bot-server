/**
 * 简化的 LLM 错误类型
 */

export class LLMServiceError extends Error {
  public status?: number;
  public headers?: Record<string, any>;
  public error?: Record<string, any>;
  public override cause?: any;
  
  constructor(message: string, cause?: any) {
    super(message);
    this.name = 'LLMServiceError';
    this.cause = cause;
  }
}

export class LLMTimeoutError extends LLMServiceError {
  constructor(message: string = 'LLM请求超时') {
    super(message);
    this.name = 'LLMTimeoutError';
  }
}

export class LLMQuotaExceededError extends LLMServiceError {
  constructor(message: string = 'LLM配额已用完') {
    super(message);
    this.name = 'LLMQuotaExceededError';
  }
}

export class LLMAuthenticationError extends LLMServiceError {
  constructor(message: string = 'LLM认证失败') {
    super(message);
    this.name = 'LLMAuthenticationError';
  }
}

export class LLMRateLimitError extends LLMServiceError {
  constructor(message: string = 'LLM请求频率限制') {
    super(message);
    this.name = 'LLMRateLimitError';
  }
}

export class LLMParsingError extends LLMServiceError {
  constructor(message: string = 'LLM响应解析失败') {
    super(message);
    this.name = 'LLMParsingError';
  }
}

export class LLMConfigurationError extends LLMServiceError {
  constructor(message: string = 'LLM配置错误') {
    super(message);
    this.name = 'LLMConfigurationError';
  }
}
