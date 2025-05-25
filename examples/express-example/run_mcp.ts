import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { createExpressAdapter } from '../../src/adapters/express.js';
import { WeatherAPIAgent } from './agent.js';

// Create MCP server
const server = new McpServer({
  name: 'Weather API MCP Server',
  version: '1.0.0'
});

// Define the input schema for the weather API
const InputSchema = z.object({
  endpoint: z.string().describe('The API endpoint to call (e.g., /weather/london, /health)'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).describe('HTTP method'),
  data: z.record(z.any()).optional().describe('Request data/body for POST requests')
});

type InputType = z.infer<typeof InputSchema>;

const name = 'weather_api_agent';
const description = 'A weather API agent that can retrieve and update weather information for various cities';

// Create an adapter for Express
const mcpExpressAgent = createExpressAdapter({
  agentInstance: new WeatherAPIAgent(),
  name: name,
  description: description,
  inputSchema: {
    endpoint: z.string().describe('API endpoint'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).describe('HTTP method'),
    data: z.record(z.any()).optional().describe('Request data')
  }
});

// Add the tool to the server
server.tool(
  name,
  InputSchema,
  mcpExpressAgent
);

// Server entrypoints
async function serveStdio() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('Weather API MCP Server running on stdio');
}

async function serveSSE() {
  const app = express();
  app.use(express.json());

  // Map to store transports by session ID
  const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

  // Handle POST requests for client-to-server communication
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          transports[sessionId] = transport;
        }
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
        }
      };

      await server.connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  });

  // Handle GET requests for server-to-client notifications
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  });

  // Handle DELETE requests for session termination
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  });

  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => {
    console.log(`Weather API MCP Server running on http://localhost:${PORT}`);
  });
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const transport = args[0] || 'stdio';

  try {
    if (transport === 'sse') {
      await serveSSE();
    } else {
      await serveStdio();
    }
  } catch (error) {
    console.error('Error starting MCP server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Weather API MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down Weather API MCP Server...');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 