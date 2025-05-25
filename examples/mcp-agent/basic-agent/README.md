# MCP Basic Agent (TypeScript)

A basic MCP (Model Context Protocol) agent example implemented in TypeScript.

## Overview

This example demonstrates how to create a simple MCP agent using the official TypeScript SDK. The agent can process user queries and provides access to filesystem and web fetching capabilities.

## Prerequisites

- Node.js 18+ 
- npm or yarn

## Installation

```bash
npm install
```

## Environment Setup

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your-openai-api-key-here
```

## Usage

### Development

```bash
# Run in development mode with hot reload
npm run dev
```

### Production

```bash
# Build the project
npm run build

# Run the built version
npm start
```

### MCP Server

```bash
# Run as MCP server on stdio transport
npm run serve:stdio

# Run as MCP server on SSE transport (HTTP)
npm run serve:sse
```

## Features

- **MCP Tool**: `basic_agent` - Processes user queries and returns responses
- **MCP Resource**: `settings://app` - Provides access to application configuration
- **Environment Variables**: Secure handling of API keys and configuration
- **TypeScript**: Full type safety and modern JavaScript features

## Project Structure

```
src/
├── index.ts      # Main application entry point
└── run-mcp.ts    # MCP server implementation
```

## Configuration

The agent supports the following configuration options in the `Settings` interface:

- `executionEngine`: Execution environment
- `logger`: Logging configuration
- `mcp`: MCP server configurations
- `openai`: OpenAI API configuration

## MCP Integration

This server implements the Model Context Protocol and can be integrated with MCP-compatible clients. It provides:

1. **Tools**: Interactive functions that can be called by LLMs
2. **Resources**: Data sources that can be read by LLMs  
3. **Server Configuration**: Accessible via the settings resource

## Development Notes

- The TypeScript implementation uses the official `@modelcontextprotocol/sdk`
- Zod is used for runtime type validation
- Environment variables are handled securely with dotenv
- Full async/await support for modern JavaScript patterns

## Migration from Python

This TypeScript version is equivalent to the original Python implementation, with the following key differences:

- Uses `@modelcontextprotocol/sdk` instead of `mcp-agent`
- Environment variables handled with `dotenv` package
- Type safety provided by TypeScript interfaces
- Modern ES modules instead of Python imports 