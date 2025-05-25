import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { z } from 'zod';
import { QueryAgent } from './index.js';

// Input schemas
const QuerySchema = z.object({
  query: z.string().describe("Natural language query for the agent")
});

const SQLQuerySchema = z.object({
  query: z.string().describe("SQL query to execute against the city database")
});

const VectorQuerySchema = z.object({
  query: z.string().describe("Vector search query"),
  topK: z.number().optional().describe("Number of results to return (default: 3)")
});

// Create MCP server
const server = new McpServer({
  name: "LlamaIndex Query Agent",
  version: "1.0.0"
});

let queryAgent: QueryAgent | null = null;

// Initialize the agent lazily
async function getAgent(): Promise<QueryAgent> {
  if (!queryAgent) {
    queryAgent = new QueryAgent();
    // Give it time to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  return queryAgent;
}

// Add general query tool
server.tool(
  "query_agent",
  {
    query: z.string().describe("Natural language query for the agent")
  },
  async ({ query }: { query: string }) => {
    try {
      const agent = await getAgent();
      const response = await agent.processQuery(query);
      
      return {
        content: [{
          type: "text",
          text: response
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error processing query: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }
);

// Add SQL query tool
server.tool(
  "query_sql",
  {
    query: z.string().describe("SQL query to execute against the city database")
  },
  async ({ query }: { query: string }) => {
    try {
      const agent = await getAgent();
      const results = await agent.querySQL(query);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `SQL Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }
);

// Add vector search tool
server.tool(
  "query_vector",
  {
    query: z.string().describe("Vector search query"),
    topK: z.number().optional().describe("Number of results to return (default: 3)")
  },
  async ({ query, topK = 3 }: { query: string; topK?: number }) => {
    try {
      const agent = await getAgent();
      const results = await agent.queryVector(query, topK);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Vector Search Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }
);

// Add resource for database schema
server.resource(
  "database-schema",
  "schema://city_stats",
  async () => ({
    contents: [{
      uri: "schema://city_stats",
      text: `Database Schema:
      
Table: city_stats
- city_name (TEXT, PRIMARY KEY): Name of the city
- population (INTEGER): Population count
- country (TEXT): Country where the city is located

Sample Data:
- Toronto: 2,930,000 (Canada)
- Tokyo: 13,960,000 (Japan) 
- Berlin: 3,645,000 (Germany)`,
      mimeType: "text/plain"
    }]
  })
);

// Add resource for available cities
server.resource(
  "cities",
  "data://cities",
  async () => {
    try {
      const agent = await getAgent();
      const cities = await agent.querySQL("SELECT * FROM city_stats ORDER BY population DESC");
      
      return {
        contents: [{
          uri: "data://cities",
          text: JSON.stringify(cities, null, 2),
          mimeType: "application/json"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: "data://cities",
          text: `Error loading cities: ${error instanceof Error ? error.message : 'Unknown error'}`,
          mimeType: "text/plain"
        }]
      };
    }
  }
);

// Server entry points
async function serveSSE() {
  console.log("SSE transport not implemented in this example");
  process.exit(1);
}

async function serveStdio() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("LlamaIndex Query Agent MCP Server running on stdio transport");
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

// Handle process cleanup
process.on('SIGINT', async () => {
  console.log('Shutting down MCP server...');
  if (queryAgent) {
    await queryAgent.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down MCP server...');
  if (queryAgent) {
    await queryAgent.close();
  }
  process.exit(0);
});

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