import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { z } from 'zod';

// Configuration settings (equivalent to Python settings)
interface Settings {
  executionEngine: string;
  logger: {
    type: string;
    level: string;
  };
  mcp: {
    servers: {
      [key: string]: {
        command: string;
        args: string[];
      };
    };
  };
  openai: {
    apiKey: string | undefined;
    defaultModel: string;
  };
}

const settings: Settings = {
  executionEngine: "asyncio",
  logger: {
    type: "file",
    level: "debug"
  },
  mcp: {
    servers: {
      fetch: {
        command: "uvx",
        args: ["mcp-server-fetch"]
      },
      filesystem: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem"]
      }
    }
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel: "gpt-4o-mini"
  }
};

// Create MCP server
const server = new McpServer({
  name: "mcp_basic_agent",
  version: "1.0.0"
});

// Agent instruction (equivalent to Python agent configuration)
const agentInstruction = `You are an agent with access to the filesystem, 
as well as the ability to fetch URLs. Your job is to identify 
the closest match to a user's request, make the appropriate tool calls, 
and return the URI and CONTENTS of the closest match.`;

// Add a tool for agent queries
server.tool(
  "basic_agent",
  {
    query: z.string().describe("The user's query to process")
  },
  async ({ query }: { query: string }) => {
    // This would integrate with your agent logic
    // For now, we'll return a simple response
    return {
      content: [{
        type: "text",
        text: `Processing query: ${query}\n\nInstruction: ${agentInstruction}`
      }]
    };
  }
);

// Add resources for server configuration
server.resource(
  "settings",
  "settings://app",
  async (uri: URL) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify(settings, null, 2),
      mimeType: "application/json"
    }]
  })
);

// Initialize and start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("MCP Basic Agent server running on stdio transport");
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

// Start the server
main().catch(console.error); 