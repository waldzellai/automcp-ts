import { ensureSerializable, extractParamsFromArgs, parseInputWithSchema, type SchemaLike } from './utils.js';
import { ToolResult } from './base.js';

interface BaseModel {
  [key: string]: any;
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
  inputSchema?: SchemaLike
): (...args: any[]) => Promise<ToolResult> {
  const runAgent = async (...args: any[]): Promise<ToolResult> => {
    const params = extractParamsFromArgs(args, inputSchema);
    const inputDict = parseInputWithSchema(inputSchema, params);
    const effectiveInput = inputDict && typeof inputDict === 'object'
      ? inputDict
      : params;

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
        result = await agentInstance.ainvoke(effectiveInput);
      } else if (typeof agentInstance.invoke === 'function') {
        result = await agentInstance.invoke(effectiveInput);
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
  inputSchema?: SchemaLike
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