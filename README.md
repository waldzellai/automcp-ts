# AutoMCP-TS

A powerful TypeScript tool for converting various AI agent frameworks into Model Context Protocol (MCP) servers. AutoMCP-TS enables seamless integration with MCP-compatible applications like Claude Desktop, bringing your AI agents into the MCP ecosystem with full TypeScript support.

## Overview

AutoMCP-TS automatically converts agents and tools from popular AI frameworks into MCP servers, enabling seamless integration with MCP-compatible applications like Claude Desktop.

## Features

- **Multi-Framework Support**: Convert agents from various AI frameworks
- **TypeScript-First**: Full TypeScript support with proper type definitions
- **Async/Await**: Modern async/await patterns throughout
- **Express Integration**: Built-in Express.js adapter for web applications
- **CLI Tool**: Easy-to-use command-line interface
- **Template System**: Configurable templates for different frameworks
- **Zero Dependencies on Python**: Pure TypeScript/JavaScript implementation

## Supported Frameworks

The TypeScript version includes adapters for:

- **CrewAI**: Multi-agent systems (`createCrewAIAdapter`)
- **LangGraph**: Graph-based agents (`createLangGraphAdapter`) 
- **OpenAI Agents**: OpenAI SDK agents (`createOpenAIAdapter`)
- **Pydantic Agents**: Schema-validated agents (`createPydanticAdapter`)
- **LlamaIndex**: Retrieval-augmented agents (`createLlamaIndexAdapter`)
- **MCP Agents**: Native MCP agents (`createMcpAgentAdapter`)
- **Express**: Web-based agents (`createExpressAdapter`)

## Installation

### From NPM (when published)
```bash
npm install -g automcp-ts
```

### From Source
```bash
git clone https://github.com/waldzellai/automcp-ts
cd automcp-ts
npm install
npm run build
npm link
```

## Quick Start

### 1. Initialize a New MCP Server

```bash
# Create a new MCP server for your framework
automcp-ts init --framework langgraph
```

This creates a `run_mcp.ts` file with a template for your chosen framework.

### 2. Configure Your Agent

Edit the generated `run_mcp.ts` file:

```typescript
import { createLangGraphAdapter } from 'automcp-ts/lib/adapters/langgraph.js';
import { z } from 'zod';
import { MyLangGraphAgent } from './my-agent.js';

// Define input schema
const InputSchema = z.object({
  query: z.string().describe('User query to process'),
  context: z.string().optional().describe('Additional context')
});

// Create adapter
const mcpAgent = createLangGraphAdapter(
  MyLangGraphAgent,
  'My LangGraph Agent',
  'Processes queries using LangGraph',
  InputSchema
);

// Add to MCP server
server.tool('my-agent', InputSchema, mcpAgent);
```

### 3. Run Your Server

```bash
# STDIO transport (for Claude Desktop)
npm run serve

# HTTP/SSE transport (for web applications)
npm run serve:sse
```

### Protocol Version Negotiation

When using the HTTP/SSE transport, clients should include an `MCP-Protocol-Version`
header on each request. If omitted, the server falls back to the SDK's
`DEFAULT_NEGOTIATED_PROTOCOL_VERSION`. Every HTTP response from the server will
echo this header so clients can confirm the negotiated protocol version.

## Adapter API Reference

### Common Interfaces

All adapters share these common TypeScript interfaces:

```typescript
interface BaseModel {
  [key: string]: any;
  model_dump?(): Record<string, any>;
}

interface ModelClass {
  new (data: any): BaseModel;
  model_fields?: Record<string, FieldInfo>;
}
```

### CrewAI Adapter

```typescript
import { createCrewAIAdapter } from 'automcp-ts/lib/adapters/crewai.js';

const adapter = createCrewAIAdapter(
  crewInstance,      // Your CrewAI agent
  'agent-name',      // Tool name
  'description',     // Tool description
  InputSchema        // Zod or custom schema
);
```

### LangGraph Adapter

```typescript
import { createLangGraphAdapter } from 'automcp-ts/lib/adapters/langgraph.js';

const adapter = createLangGraphAdapter(
  graphAgent,        // Your LangGraph agent
  'graph-agent',     // Tool name
  'description',     // Tool description
  InputSchema        // Input schema
);
```

### OpenAI Adapter

```typescript
import { createOpenAIAdapter } from 'automcp-ts/lib/adapters/openai.js';

const adapter = createOpenAIAdapter(
  openaiAgent,       // Your OpenAI agent
  'openai-agent',    // Tool name
  'description',     // Tool description
  InputSchema,       // Input schema
  customRunner       // Optional: custom runner
);
```

### Pydantic Adapter

```typescript
import { createPydanticAdapter } from 'automcp-ts/lib/adapters/pydantic.js';

const adapter = createPydanticAdapter(
  pydanticAgent,     // Your Pydantic agent
  'pydantic-agent',  // Tool name
  'description',     // Tool description
  InputSchema        // Input schema
);
```

### LlamaIndex Adapter

```typescript
import { createLlamaIndexAdapter } from 'automcp-ts/lib/adapters/llamaindex.js';

const adapter = createLlamaIndexAdapter(
  llamaAgent,        // Your LlamaIndex agent
  'llama-agent',     // Tool name
  'description',     // Tool description
  InputSchema,       // Input schema
  ContextClass       // Optional: custom context class
);
```

### MCP Agent Adapter

```typescript
import { createMcpAgentAdapter } from 'automcp-ts/lib/adapters/mcpAgent.js';

const adapter = createMcpAgentAdapter(
  agentInstance,     // Agent instance
  llm,              // Language model
  app,              // Application instance
  initializeFn,     // App initialization function
  'mcp-agent',      // Tool name
  'description',    // Tool description
  InputSchema       // Input schema
);
```

## Utilities

### JSON Serialization

The `ensureSerializable` utility converts complex objects to JSON-safe formats:

```typescript
import { ensureSerializable } from 'automcp-ts/lib/adapters/utils.js';

const safeData = ensureSerializable(complexObject);
```

### Schema Creation

Create Pydantic-like models in TypeScript:

```typescript
import { createModel } from 'automcp-ts/lib/adapters/pydantic.js';

const MyModel = createModel({
  name: { annotation: String, required: true },
  age: { annotation: Number, default: 0 }
});
```

### Structured Tool Results

When a tool returns a JavaScript object, adapters now expose this value under the
`structuredContent` field of the `ToolResult`. A formatted string version is also
included in the `content` array for compatibility. Tools can additionally supply
an optional `resource_links` array to reference external resources.

## Configuration

Framework configurations are stored in YAML files:

```yaml
frameworks:
  langgraph:
    adapter_import: createLangGraphAdapter
    adapter_module_path: automcp-ts/lib/adapters/langgraph.js
    import_comment: "// import { YourLangGraphAgent } from './your-module.js';"
    adapter_definition: |
      const mcpLanggraphAgent = createLangGraphAdapter(
        YourLangGraphAgent,
        name,
        description,
        InputSchema
      );
    adapter_variable_name: mcpLanggraphAgent
```

## Advanced Usage

### Custom Error Handling

```typescript
const adapter = createLangGraphAdapter(
  agent,
  'my-agent',
  'description',
  schema
);

// Wrap with custom error handling
const wrappedAdapter = async (...args: any[]) => {
  try {
    return await adapter(...args);
  } catch (error) {
    console.error('Agent error:', error);
    return { error: 'Agent execution failed' };
  }
};
```

### Console Output Capture

All adapters automatically capture console output to prevent interference with MCP transport protocols:

```typescript
// Console output is automatically captured and suppressed during agent execution
const result = await adapter({ query: 'Hello' });
```

### TypeScript Integration

Full TypeScript support with generic types:

```typescript
import { createTypedLangGraphAdapter } from 'automcp-ts/lib/adapters/langgraph.js';

interface MyInput {
  query: string;
  context?: string;
}

const typedAdapter = createTypedLangGraphAdapter<MyInput>(
  agent,
  'typed-agent',
  'description',
  InputSchema
);

// Full type safety
const result = await typedAdapter({ query: 'Hello', context: 'World' });
```

## Migration from Python AutoMCP

If you're migrating from Python AutoMCP, the TypeScript version provides equivalent functionality with these improvements:

1. **Better Type Safety**: Full TypeScript type definitions
2. **Modern Async**: Promise-based async/await patterns  
3. **ES Modules**: Modern module system
4. **Enhanced Error Handling**: Better error handling and logging
5. **Console Management**: Automatic console output capture

### Python to TypeScript Conversion Examples

**Python:**
```python
from automcp.adapters.langgraph import create_langgraph_adapter
from pydantic import BaseModel

class InputSchema(BaseModel):
    query: str
    
adapter = create_langgraph_adapter(agent, "name", "desc", InputSchema)
```

**TypeScript:**
```typescript
import { createLangGraphAdapter } from 'automcp-ts/lib/adapters/langgraph.js';
import { z } from 'zod';

const InputSchema = z.object({
  query: z.string()
});

const adapter = createLangGraphAdapter(agent, "name", "desc", InputSchema);
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run linting and tests
6. Submit a pull request

## Architecture

AutoMCP-TS is built with a clean, modular architecture:

- **Adapters**: Framework-specific conversion logic
- **CLI**: Command-line interface for generation
- **Templates**: Configurable server templates
- **Utilities**: Shared helper functions

Key features of the TypeScript implementation:
- **Type Safety**: Full TypeScript type definitions
- **Modern Async**: Promise-based async/await patterns
- **ES Modules**: Modern module system
- **Better Error Handling**: Enhanced error handling and logging
- **Console Management**: Automatic console output capture

## License

MIT License - see LICENSE file for details.

## Related Projects

- [Model Context Protocol](https://github.com/modelcontextprotocol/specification)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [AutoMCP Original](https://github.com/yourusername/automcp) - Python version (archived)

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/waldzellai/automcp-ts/issues)
- Documentation: [Full documentation](https://waldzellai.github.io/automcp-ts)
- Examples: [Example implementations](https://github.com/waldzellai/automcp-ts/tree/main/examples)
