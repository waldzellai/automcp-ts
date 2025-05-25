import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { z } from 'zod';

// Input schema for the agent (equivalent to Python InputSchema)
const InputSchema = z.object({
  query: z.string().describe("The user's query to process")
});

type InputType = z.infer<typeof InputSchema>;

// Create MCP server
const server = new McpServer({
  name: "MCP Server",
  version: "1.0.0"
});

const name = "multipurpose_agent";
const description = "A multipurpose agent that can help you with reading filesystem and fetch information from the web";

// Add the multipurpose agent tool
server.tool(
  name,
  {
    query: z.string().describe("The user's query for the agent to process")
  },
  async ({ query }: { query: string }) => {
    // This is where we would integrate with the actual agent logic
    // For now, return a placeholder response
    return {
      content: [{
        type: "text",
        text: `Agent processing: ${query}\n\nAgent: ${description}`
      }]
    };
  }
);

// Server entry points
async function serveSSE() {
  // For HTTP/SSE transport, you would set up an Express server
  // This is a placeholder for now
  console.log("SSE transport not implemented in this basic example");
  process.exit(1);
}

async function serveStdio() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("MCP Server running on stdio transport");
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Main execution logic
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0] === "sse") {
    await serveSSE();
  } else {
    await serveStdio();
  }
}

// Handle process errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Run the server
main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
}); 