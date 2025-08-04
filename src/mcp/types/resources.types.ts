/**
 * @file resources/types.ts
 * @description 资源管理模块的类型定义
 */

/**
 * 资源的唯一标识符 (Uniform Resource Identifier)
 */
export type ResourceURI = string;

/**
 * 资源提供者接口
 * 每个提供者负责处理一种特定类型的资源（如file, http）
 */
export interface IResourceProvider {
  /**
   * 检查此提供者是否能处理给定的URI
   * @param uri 资源的URI
   * @returns 如果能处理则返回 true, 否则返回 false
   */
  canHandle(uri: ResourceURI): boolean;

  /**
   * 加载资源内容
   * @param uri 资源的URI
   * @returns 返回包含资源内容的Promise
   * @throws 如果加载失败，则抛出错误
   */
  load(uri: ResourceURI): Promise<string>;
}

/**
 * 资源管理器接口
 */
export interface IResourceManager {
  /**
   * 注册一个资源提供者
   * @param provider 要注册的资源提供者
   */
  registerProvider(provider: IResourceProvider): void;

  /**
   * 获取资源内容
   * @param uri 资源的URI
   * @returns 返回包含资源内容的Promise
   * @throws 如果没有合适的提供者或加载失败，则抛出错误
   */
  getResource(uri: ResourceURI): Promise<string>;
}
