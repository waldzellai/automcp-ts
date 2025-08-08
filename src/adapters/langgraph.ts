import { ensureSerializable } from './utils.js';
import { ToolResult } from './base.js';

interface BaseModel {
  [key: string]: any;
  model_dump?(): Record<string, any>;
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
  ainvoke?(input: Record<string, any>): Promise<any>;
  invoke?(input: Record<string, any>): Promise<any>;
}

/**
 * Convert a LangGraph agent/graph to an MCP tool.
 */
export function createLangGraphAdapter(
  agentInstance: LangGraphAgent,
  name: string,
  description: string,
  inputSchema?: ModelClass
): (...args: any[]) => Promise<ToolResult> {
  const runAgent = async (...args: any[]): Promise<ToolResult> => {
    // Prefer a single params object (as provided by MCP server.tool)
    let params: Record<string, any> = {};

    if (args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      params = args[0] as Record<string, any>;
    } else if (inputSchema && inputSchema.model_fields) {
      // Positional mapping fallback for Pydantic-like model classes
      const schemaFields = inputSchema.model_fields || {};
      const fieldNames = Object.keys(schemaFields);
      fieldNames.forEach((fieldName, index) => {
        if (index < args.length) {
          params[fieldName] = args[index];
        }
      });
    }

    // Create the input object if a Pydantic-like class is provided
    let inputDict: Record<string, any> = params;
    if (inputSchema && typeof inputSchema === 'function') {
      try {
        const instance = new inputSchema(params);
        if (typeof instance.model_dump === 'function') {
          inputDict = instance.model_dump();
        }
      } catch {
        // Ignore and use params directly
      }
    }

    // Capture console output to avoid interfering with transports
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const outputBuffer: string[] = [];

    console.log = (...a) => outputBuffer.push(a.join(' '));
    console.warn = (...a) => outputBuffer.push(a.join(' '));
    console.error = (...a) => outputBuffer.push(a.join(' '));

    try {
      // Call invoke/ainvoke depending on availability
      let result: any;
      if (typeof agentInstance.ainvoke === 'function') {
        result = await agentInstance.ainvoke(inputDict);
      } else if (typeof agentInstance.invoke === 'function') {
        result = await agentInstance.invoke(inputDict);
      } else {
        throw new Error('Provided LangGraph agent does not implement invoke or ainvoke');
      }

      const output = ensureSerializable(result);
      if (output && typeof output === 'object') {
        return {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      }
      return { content: [{ type: 'text', text: String(output) }] };
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  };

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
  inputSchema?: ModelClass
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
  async invoke(input: Record<string, any>): Promise<any> {
    return {
      result: 'Mock LangGraph result',
      input,
      processed: true
    };
  }
} 