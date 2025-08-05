import { createMCPLogger } from '../utils/logger.js';
import { MCPError } from '../utils/errors.js';
import { IMCPServer, ITool } from '../types/index.js';

const logger = createMCPLogger('ServerManager');

type ServerRegistration = {
  name: string;
  server: IMCPServer;
};

export class ServerManager {
  private servers: Map<string, IMCPServer> = new Map();
  private static instance: ServerManager;

  private constructor() {}

  public static getInstance(): ServerManager {
    if (!ServerManager.instance) {
      ServerManager.instance = new ServerManager();
    }
    return ServerManager.instance;
  }

  public async registerAndStartServers(registrations: ServerRegistration[]): Promise<void> {
    logger.info(`Registering and starting ${registrations.length} servers...`);
    for (const reg of registrations) {
      try {
        await this.startServer(reg.name, reg.server);
      } catch (error) {
        logger.error(`Failed to start server '${reg.name}'`, error);
        // Decide if one failure should stop the whole process. For now, we continue.
      }
    }
  }

  private async startServer(name: string, server: IMCPServer): Promise<void> {
    if (this.servers.has(name)) {
      logger.warn(`Server with name '${name}' is already registered. Skipping.`);
      return;
    }

    logger.info(`Starting server '${name}'...`);
    await server.start();
    this.servers.set(name, server);
    logger.info(`Successfully started and registered server '${name}'.`);
  }

  public getServer(name: string): IMCPServer | undefined {
    return this.servers.get(name);
  }

  public getAllServers(): IMCPServer[] {
    return Array.from(this.servers.values());
  }

  public registerTool(serverName: string, tool: ITool): void {
    const server = this.getServer(serverName);
    if (server) {
      server.registerTool(tool);
    } else {
      throw MCPError.serverNotFound(serverName);
    }
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
