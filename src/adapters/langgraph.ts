import { ensureSerializable } from './utils.js';
import { ToolResult } from './base.js';

interface BaseModel {
  [key: string]: any;
  model_dump(): Record<string, any>;
}

interface FieldInfo {
  annotation?: any;
  required?: boolean;
  default?: any;
}

interface ModelClass {
  new (data: any): BaseModel;
  model_fields?: Record<string, FieldInfo>;
}

interface LangGraphAgent {
  ainvoke(input: Record<string, any>): Promise<any>;
}

/**
 * Convert a graph object to an MCP tool, making it async.
 */
export function createLangGraphAdapter(
  agentInstance: LangGraphAgent,
  name: string,
  description: string,
  inputSchema: ModelClass
): (...args: any[]) => Promise<ToolResult> {
  const runAgent = async (...args: any[]): Promise<ToolResult> => {
    // Convert args to object based on schema
    const kwargs: Record<string, any> = {};
    
    // If args is a single object, use it directly
    if (args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      Object.assign(kwargs, args[0]);
    } else {
      // Otherwise, map positional args to schema fields
      const schemaFields = inputSchema.model_fields || {};
      const fieldNames = Object.keys(schemaFields);
      fieldNames.forEach((fieldName, index) => {
        if (index < args.length) {
          kwargs[fieldName] = args[index];
        }
      });
    }
    
    // Create the input object
    const inputData = new inputSchema(kwargs);
    const inputDict = inputData.model_dump();
    
    // Redirect stdout equivalent (capture console output)
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const outputBuffer: string[] = [];
    
    // Override console methods to capture output
    console.log = (...args) => outputBuffer.push(args.join(' '));
    console.warn = (...args) => outputBuffer.push(args.join(' '));
    console.error = (...args) => outputBuffer.push(args.join(' '));
    
    try {
      // Call the async invoke method
      const result = await agentInstance.ainvoke(inputDict);
      const output = ensureSerializable(result);
      if (output && typeof output === 'object') {
        return {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      }
      return { content: [{ type: 'text', text: String(output) }] };
    } finally {
      // Restore original console methods
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  };
  
  // Add proper function metadata
  Object.defineProperty(runAgent, 'name', { value: name });
  Object.defineProperty(runAgent, 'description', { value: description });
  
  return runAgent;
}

/**
 * Create a typed wrapper for LangGraph adapter with specific input schema
 */
export function createTypedLangGraphAdapter<T extends BaseModel>(
  agentInstance: LangGraphAgent,
  name: string,
  description: string,
  inputSchema: ModelClass
): (input: T) => Promise<ToolResult> {
  const adapter = createLangGraphAdapter(agentInstance, name, description, inputSchema);

  return async (input: T): Promise<ToolResult> => {
    return await adapter(input);
  };
}

/**
 * Mock LangGraph agent for testing
 */
export class MockLangGraphAgent implements LangGraphAgent {
  async ainvoke(input: Record<string, any>): Promise<any> {
    // Mock implementation - would need to be replaced with actual LangGraph equivalent
    return {
      result: "Mock LangGraph result",
      input: input,
      processed: true
    };
  }
} 