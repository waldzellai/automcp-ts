import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Import our translator agent
import { TranslatorAgent } from './main.js';

// Create MCP server
const server = new Server(
  {
    name: 'translator-mcp-server',
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
  message: z.string().describe('The message to translate'),
  languages: z.array(z.string()).optional().describe('Target languages (Spanish, French, Italian)'),
});

type InputType = z.infer<typeof InputSchema>;

// Create the translator agent instance
const translatorAgent = new TranslatorAgent();
const orchestratorAgent = translatorAgent.getOrchestratorAgent();

const toolName = 'translator_agent';
const toolDescription = 'A translator agent that translates text from English to French, Italian, and Spanish';

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
            message: {
              type: 'string',
              description: 'The message to translate',
            },
            languages: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Target languages (Spanish, French, Italian)',
            },
          },
          required: ['message'],
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
      
      let result: string;

      if (validatedInput.languages && validatedInput.languages.length > 0) {
        // Use direct translation method
        try {
          const translations = await translatorAgent.processTranslationRequest(
            validatedInput.message,
            validatedInput.languages
          );
          
          const translationResults = Object.entries(translations)
            .map(([lang, translation]) => `${lang}: ${translation}`)
            .join('\n');
          
          result = `Translations for "${validatedInput.message}":\n${translationResults}`;
        } catch (error) {
          result = `Translation error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      } else {
        // Use orchestrator agent for general handling
        try {
          const agentResult = await orchestratorAgent.run(validatedInput.message);
          result = agentResult;
        } catch (error) {
          result = `Agent error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: result,
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

export { server, translatorAgent }; 