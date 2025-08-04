import "dotenv/config";
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { config } from './config/index.js';
import { mainRouter } from './routes/index.js';
import { handleSuccess, handleError } from './middlewares/response.middleware.js';
import { createLogger } from './utils/logger.js';
import { mcp } from './mcp/index.js';

// --- Application-level Server and Tool definitions ---
import { DefaultMCPServer } from './servers/default/mcp-server.js';
import AshitaNoJoeTool from './servers/default/ashitano-joe.tool.js';
import JoJoTool from './servers/default/jojo.tool.js';
import { FileProvider } from './mcp/resources/providers/file-provider.js';

const app = express();
const logger = createLogger('Server');

// --- Middleware Configuration ---
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(cors());

// --- Route Configuration ---
app.use('/', mainRouter);

// --- Response Handling Middleware (must be after routes) ---
app.use(handleSuccess);
app.use(handleError);

/**
 * Starts the Express server and initializes application services.
 */
async function startServer() {
  try {
    // 1. Create instances of our application's servers and tools
    const defaultServer = new DefaultMCPServer(
      { port: 4001, host: 'localhost' },
      [AshitaNoJoeTool, JoJoTool]
    );

    // 2. Prepare the server registrations to be injected into the MCP module
    const serverRegistrations = [
      { name: 'default-server', server: defaultServer },
      // Add other servers here if needed
    ];

    // 3. Prepare the resource provider registrations
    const resourceProviders = [
      new FileProvider(), // The root directory defaults to process.cwd()
      // Add other providers like HttpProvider here
    ];

    // 4. Start the MCP service, injecting servers and resource providers.
    await mcp.service.start(undefined, serverRegistrations, resourceProviders);

    // 5. Start the Express application
    app.listen(config.port, () => {
      const agentStatus = mcp.service.getAgent()?.getStatus();
      logger.info('Server started successfully', {
        port: config.port,
        mcpEnabled: agentStatus?.enabled || false,
        registeredTools: agentStatus?.registeredTools || [],
      });
    });

  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

// Start the server
startServer();
