import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Import our weather agent
import { WeatherAgent } from './main.js';

// Create MCP server
const server = new Server(
  {
    name: 'weather-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define the input schema using Zod (TypeScript equivalent of Pydantic BaseModel)
const InputSchema = z.object({
  query: z.string().describe('The weather query to process'),
});

type InputType = z.infer<typeof InputSchema>;

// Create the weather agent instance
const weatherAgent = new WeatherAgent(
  'openai:gpt-4o-mini',
  'Be concise, reply with one sentence. ' +
  'Use the getLatLng tool to get the latitude and longitude of the locations, ' +
  'then use the getWeather tool to get the weather.',
  2
);

const toolName = 'weather_agent';
const toolDescription = 'A weather agent that can help you get the weather of a city';

// Add tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: toolName,
        description: toolDescription,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The weather query to process',
            },
          },
          required: ['query'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === toolName) {
    try {
      // Validate input using Zod schema
      const validatedInput = InputSchema.parse(args);
      
      // Call the weather agent
      const result = await weatherAgent.runSync(validatedInput.query);
      
      return {
        content: [
          {
            type: 'text',
            text: result.data,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Server entrypoints
async function serveStdio(): Promise<void> {
  // Suppress console.error to prevent warnings from corrupting STDIO
  const originalConsoleError = console.error;
  console.error = () => {}; // Ignore all error outputs

  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    // Keep the server running
    await new Promise(() => {}); // Run indefinitely
  } finally {
    // Restore console.error for normal operation
    console.error = originalConsoleError;
  }
}

async function serveSSE(): Promise<void> {
  // Note: SSE transport would require additional setup
  // For now, we'll just log that SSE is not implemented
  console.error('SSE transport not implemented in this example');
  console.error('Use STDIO transport instead');
  process.exit(1);
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0] === 'sse') {
    await serveSSE();
  } else {
    await serveStdio();
  }
}

// Execute if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { server, weatherAgent }; 