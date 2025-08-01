import { JoJoTool } from './jojo-tool.js';
import { MCPServerOptions } from './mcp-server.js';
import { ITool } from '../../types/index.js';

export interface ServerModuleConfig {
    serverOptions: MCPServerOptions;
    tools: (new () => ITool)[];
}

const config: ServerModuleConfig = {
    serverOptions: {
        port: 3001,
        host: 'localhost',
    },
    tools: [
        JoJoTool
    ]
};

export default config; 
