import { ToolResult } from './base.js';
import { ensureSerializable, extractParamsFromArgs, parseInputWithSchema, type SchemaLike } from './utils.js';

interface BaseModel {
  [key: string]: any;
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
  inputSchema?: SchemaLike,
): (...args: any[]) => Promise<ToolResult> {
  const runAgent = async (...args: any[]): Promise<ToolResult> => {
    const params = extractParamsFromArgs(args, inputSchema);
    const parsedParams = parseInputWithSchema(inputSchema, params);
    const effectiveParams = parsedParams && typeof parsedParams === 'object'
      ? parsedParams
      : params;

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
        const queryInput = effectiveParams && typeof effectiveParams === 'object'
          ? (effectiveParams as Record<string, any>).query ?? effectiveParams
          : effectiveParams;
        response = await agentInstance.chat(queryInput);
      } else if (typeof agentInstance.query === 'function') {
        const queryInput = effectiveParams && typeof effectiveParams === 'object'
          ? (effectiveParams as Record<string, any>).query ?? effectiveParams
          : effectiveParams;
        response = await agentInstance.query(queryInput);
      } else if (typeof agentInstance.run === 'function') {
        const inputValues = Array.isArray(effectiveParams)
          ? effectiveParams
          : Object.values(effectiveParams);
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
  inputSchema?: SchemaLike,
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