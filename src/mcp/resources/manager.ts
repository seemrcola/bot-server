/**
 * @file resources/manager.ts
 * @description 资源管理器，负责加载和提供外部资源
 */

import { IResourceManager, IResourceProvider, ResourceURI } from '../types/resources.types.js';
import { createMCPLogger } from '../utils/logger.js';

const logger = createMCPLogger('ResourceManager');

export class ResourceManager implements IResourceManager {
  private static instance: ResourceManager;
  private providers: IResourceProvider[] = [];

  private constructor() {
    logger.info('ResourceManager initialized.');
  }

  public static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  public registerProvider(provider: IResourceProvider): void {
    this.providers.push(provider);
    logger.info(`Resource provider registered: ${provider.constructor.name}`);
  }

  public async getResource(uri: ResourceURI): Promise<string> {
    const provider = this.providers.find(p => p.canHandle(uri));

    if (!provider) {
      logger.error(`No provider found for resource URI: ${uri}`);
      throw new Error(`No resource provider available for the URI scheme: ${uri}`);
    }

    try {
      logger.info(`Loading resource "${uri}" using ${provider.constructor.name}...`);
      return await provider.load(uri);
    } catch (error) {
      logger.error(`Failed to load resource "${uri}"`, error);
      throw new Error(`Failed to load resource: ${uri}`);
    }
  }

  public getRegisteredProviders(): string[] {
    return this.providers.map(p => p.constructor.name);
  }
}

export const resourceManager = ResourceManager.getInstance();
