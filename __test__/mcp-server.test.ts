import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import getPort from 'get-port';
import express from 'express';

async function createMCPTestServer() {
  const name = 'standalone-test-server';
  const version = '1.0.0';

  const server = new McpServer({
    name,
    version,
  });

  // Define a simple tool to verify the connection
  server.tool(
    'ping',
    'A simple tool to check if the server is responsive. Returns "pong".',
    {
      type: 'object',
      properties: {}, // No input arguments
    },
    async () => {
      console.log(`[Standalone MCP Server] Received a call to 'ping'`);
      return {
        content: [{ type: 'text', text: 'pong' }],
        structuredContent: { status: 'ok', reply: 'pong' },
      };
    },
  );

  const app = express();

  const port = await getPort();

  app.listen(port, () => {
    console.log(`MCP server is running on port ${port}`);
  });

  return {
    name,
    version,
    url: `http://localhost:${port}/mcp`,
  }
}

export const standaloneTestServer = createMCPTestServer();
