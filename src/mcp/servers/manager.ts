import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { MCPServer } from './default/mcp-server.js';
import { createMCPLogger } from '../utils/logger.js';
import { MCPError } from '../utils/errors.js';

const logger = createMCPLogger('ServerManager');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ServerManager {
  private servers: Map<string, MCPServer> = new Map();
  private static instance: ServerManager;

  private constructor() {}

  public static getInstance(): ServerManager {
    if (!ServerManager.instance) {
      ServerManager.instance = new ServerManager();
    }
    return ServerManager.instance;
  }

  public async discoverAndStartServers(): Promise<void> {
    const serversPath = path.resolve(__dirname);
    logger.info(`Discovering servers in: ${serversPath}`);

    try {
      const serverDirs = await fs.readdir(serversPath, { withFileTypes: true });

      for (const dirent of serverDirs) {
        if (dirent.isDirectory()) {
          const serverName = dirent.name;
          const serverPath = path.join(serversPath, serverName);
          await this.loadAndStartServer(serverName, serverPath);
        }
      }
    } catch (error) {
        logger.error('Failed to discover or start servers', error);
        throw MCPError.initializationError('服务器发现或启动失败', error);
    }
  }

  private async loadAndStartServer(name: string, serverPath: string): Promise<void> {
    try {
      logger.info(`Loading server '${name}' from ${serverPath}`);
      
      // 确定服务器配置和文件扩展名
      const isProduction = process.env['NODE_ENV'] === 'production';
      const ext = isProduction ? '.js' : '.ts';
      
      // 构建服务器模块路径
      const serverModulePath = path.join(serverPath, `mcp-server${ext}`);
      
      // 动态导入服务器模块
      const serverModule = await import(serverModulePath);
      const ServerClass = serverModule.MCPServer || serverModule.default;
      
      if (!ServerClass) {
        throw new Error(`No server class found in ${serverModulePath}`);
      }

      const serverOptions = {
        port: isProduction ? 4001 : 3001,
        host: isProduction ? '0.0.0.0' : 'localhost'
      };

      const tools = await this.loadTools(serverPath, ext);

      // 创建服务器实例
      const serverInstance = new ServerClass(serverOptions, tools);
      
      logger.info(`Starting server '${name}' on ${serverOptions.host}:${serverOptions.port}`);
      await serverInstance.start();

      this.servers.set(name, serverInstance);
      logger.info(`Successfully started server '${name}' on port ${serverOptions.port}`);

    } catch (error) {
        logger.error(`Failed to load or start server '${name}'`, { path: serverPath, error });
    }
  }

  private async loadTools(serverPath: string, ext: string): Promise<(new () => any)[]> {
    const toolFiles = await fs.readdir(serverPath);
    const toolClasses: (new () => any)[] = [];

    for (const file of toolFiles) {
      if (file.endsWith(`.tool${ext}`)) {
        const toolPath = path.join(serverPath, file);
        try {
          const toolModule = await import(toolPath);
          const ToolClass = toolModule.default || Object.values(toolModule)[0];
          if (typeof ToolClass === 'function') {
            toolClasses.push(ToolClass);
            logger.info(`Loaded tool from ${file}`);
          }
        } catch (error) {
          logger.error(`Failed to load tool from ${toolPath}`, error);
        }
      }
    }
    return toolClasses;
  }

  public getServer(name: string): MCPServer | undefined {
    return this.servers.get(name);
  }

  public getAllServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  public async stopAllServers(): Promise<void> {
    logger.info('Stopping all managed servers...');
    for (const [name, server] of this.servers) {
      try {
        await server.stop();
        logger.info(`Server '${name}' stopped.`);
      } catch (error) {
        logger.error(`Failed to stop server '${name}'`, error);
      }
    }
    this.servers.clear();
  }
} 
