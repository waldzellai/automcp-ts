# LlamaIndex OpenAI Query Agent (TypeScript)

A sophisticated query agent built with LlamaIndex.TS that combines SQL database querying with vector search capabilities. This TypeScript implementation provides an MCP-compatible interface for both structured data queries and semantic search.

## Overview

This example demonstrates how to build a powerful query agent that can:

- **SQL Querying**: Execute queries against a structured SQLite database containing city statistics
- **Vector Search**: Perform semantic search over Wikipedia content using Pinecone vector store
- **Intelligent Routing**: Automatically determine whether to use SQL or vector search based on query content
- **MCP Integration**: Expose functionality through the Model Context Protocol for LLM integration

## Features

- **Dual Query Engines**: SQL database + Vector search with Pinecone
- **LlamaIndex.TS**: Official TypeScript implementation with full type safety
- **OpenAI Integration**: Uses GPT models for embeddings and language processing
- **MCP Server**: Exposes tools and resources via Model Context Protocol
- **Real-time Data**: Dynamic city information with population statistics
- **Error Handling**: Comprehensive error handling and logging

## Prerequisites

- Node.js 18+
- OpenAI API key
- Pinecone API key and index

## Installation

```bash
npm install
```

## Environment Setup

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your-openai-api-key-here
PINECONE_API_KEY=your-pinecone-api-key-here
```

## Usage

### Development Mode

```bash
# Run in development mode with hot reload
npm run dev
```

### Production Mode

```bash
# Build and run
npm run build
npm start
```

### MCP Server Mode

```bash
# Run as MCP server on stdio transport
npm run serve:stdio

# Run as MCP server on SSE transport (HTTP)
npm run serve:sse
```

## Architecture

### QueryAgent Class

The main `QueryAgent` class manages:

1. **Pinecone Vector Store**: For semantic search over city Wikipedia content
2. **SQLite Database**: For structured queries over city statistics
3. **Query Intelligence**: Automatic routing between SQL and vector search

### Database Schema

```sql
CREATE TABLE city_stats (
  city_name TEXT PRIMARY KEY,
  population INTEGER,
  country TEXT NOT NULL
);
```

**Sample Data:**
- Toronto: 2,930,000 (Canada)
- Tokyo: 13,960,000 (Japan)
- Berlin: 3,645,000 (Germany)

### Vector Store

- **Index**: Pinecone serverless index with 1536 dimensions
- **Content**: Wikipedia articles about major cities
- **Namespace**: `wiki_cities`
- **Embedding Model**: OpenAI `text-embedding-3-small`

## MCP Tools

### `query_agent`
General-purpose query tool that intelligently routes to SQL or vector search.

**Parameters:**
- `query` (string): Natural language query

**Example:**
```json
{
  "query": "Tell me about the arts and culture of the city with the highest population"
}
```

### `query_sql`
Direct SQL query execution against the city database.

**Parameters:**
- `query` (string): SQL query to execute

**Example:**
```json
{
  "query": "SELECT * FROM city_stats WHERE population > 5000000"
}
```

### `query_vector`
Semantic search over Wikipedia city content.

**Parameters:**
- `query` (string): Search query
- `topK` (number, optional): Number of results (default: 3)

**Example:**
```json
{
  "query": "cultural attractions and museums",
  "topK": 5
}
```

## MCP Resources

### `schema://city_stats`
Database schema and sample data information.

### `data://cities`
Live city data from the SQLite database in JSON format.

## Example Queries

1. **Population Query** (→ SQL):
   ```
   "What are the countries for cities with population over 3 million?"
   ```

2. **Cultural Query** (→ Vector Search):
   ```
   "Tell me about the history and culture of Berlin"
   ```

3. **Mixed Query** (→ Intelligent Routing):
   ```
   "What cultural attractions exist in the most populated city?"
   ```

## Project Structure

```
src/
├── index.ts      # Main QueryAgent implementation
└── run-mcp.ts    # MCP server wrapper
```

## Key Components

### LlamaIndex.TS Integration

```typescript
import { VectorStoreIndex, Settings } from 'llamaindex';
import { OpenAI } from '@llamaindex/openai';
import { PineconeVectorStore } from '@llamaindex/pinecone';
```

### Query Intelligence

The agent uses simple heuristics to route queries:

```typescript
const isSQLQuery = query.toLowerCase().includes('population') || 
                   query.toLowerCase().includes('country') ||
                   query.toLowerCase().includes('highest');
```

### Error Handling

Comprehensive error handling for:
- Pinecone connection issues
- SQLite query errors
- Vector search failures
- MCP transport problems

## Development Notes

- **TypeScript**: Full type safety with strict TypeScript configuration
- **Async/Await**: Modern JavaScript patterns throughout
- **Modular Design**: Separates concerns between query logic and MCP interface
- **Resource Management**: Proper cleanup of database connections and resources

## Migration from Python

Key differences from the Python LlamaIndex implementation:

- Uses `llamaindex` (TS) instead of `llama_index` (Python)
- SQLite integration via `sqlite3` package with promisified methods
- Pinecone client v1.0+ API with modern TypeScript interfaces
- MCP SDK integration for protocol compatibility
- ES modules instead of Python imports

## Performance Considerations

- **Lazy Initialization**: QueryAgent initializes resources on first use
- **Connection Pooling**: Reuses Pinecone connections across queries
- **Memory Management**: Proper cleanup prevents memory leaks
- **Index Caching**: Pinecone index stats checked to avoid redundant data loading

## Error Handling

The system handles various error scenarios:

- Network connectivity issues with Pinecone
- SQLite database errors and constraint violations
- OpenAI API rate limits and failures
- MCP protocol communication errors

## Contributing

1. Follow TypeScript best practices
2. Add comprehensive error handling
3. Include JSDoc comments for public methods
4. Test with real API keys before submitting
5. Update documentation for new features 