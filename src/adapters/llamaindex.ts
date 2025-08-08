import { ToolResult } from './base.js';
import { ensureSerializable } from './utils.js';

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

interface LlamaIndexAgentLike {
  run?(...args: any[]): Promise<any>;
  query?(input: any): Promise<any>;
  chat?(input: any): Promise<any>;
}

/**
 * Convert LlamaIndex agents to an MCP tool
 */
export function createLlamaIndexAdapter(
  agentInstance: LlamaIndexAgentLike,
  name: string,
  description: string,
  inputSchema?: ModelClass,
): (...args: any[]) => Promise<ToolResult> {
  const runAgent = async (...args: any[]): Promise<ToolResult> => {
    // Prefer a single params object (as provided by MCP server.tool)
    let params: Record<string, any> = {};

    if (args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      params = args[0] as Record<string, any>;
    } else if (inputSchema && inputSchema.model_fields) {
      const schemaFields = inputSchema.model_fields || {};
      const fieldNames = Object.keys(schemaFields);
      fieldNames.forEach((fieldName, index) => {
        if (index < args.length) {
          params[fieldName] = args[index];
        }
      });
    }

    // If a Pydantic-like class is provided, attempt to build input
    if (inputSchema && typeof inputSchema === 'function') {
      try {
        const instance = new inputSchema(params);
        if (typeof instance.model_dump === 'function') {
          params = instance.model_dump();
        }
      } catch {
        // Ignore and use params directly
      }
    }

    // Capture console noise
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};

    try {
      // Determine best method
      let response: any;
      if (typeof agentInstance.chat === 'function') {
        response = await agentInstance.chat(params.query ?? params);
      } else if (typeof agentInstance.query === 'function') {
        response = await agentInstance.query(params.query ?? params);
      } else if (typeof agentInstance.run === 'function') {
        const inputValues = Array.isArray(params) ? params : Object.values(params);
        response = await agentInstance.run(...inputValues);
      } else {
        throw new Error('Unsupported LlamaIndex agent type: expected chat, query, or run');
      }

      if (response && typeof response === 'object') {
        const output = ensureSerializable(response);
        return {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      }
      return { content: [{ type: 'text', text: String(response) }] };
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
 * Create a typed wrapper for LlamaIndex adapter with specific input schema
 */
export function createTypedLlamaIndexAdapter<T extends BaseModel>(
  agentInstance: LlamaIndexAgentLike,
  name: string,
  description: string,
  inputSchema?: ModelClass,
): (input: T) => Promise<ToolResult> {
  const adapter = createLlamaIndexAdapter(agentInstance, name, description, inputSchema);

  return async (input: T): Promise<ToolResult> => {
    return await adapter(input);
  };
}

/**
 * Create a LlamaIndex-style context
 */
export function createContext(agentInstance: any): any {
  return agentInstance;
} 