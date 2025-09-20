import { ensureSerializable, extractParamsFromArgs, parseInputWithSchema, type SchemaLike } from './utils.js';
import { ToolResult } from './base.js';

interface CrewAIResult {
  model_dump_json(): string;
  model_dump(): Record<string, any>;
}

interface CrewAIAgent {
  kickoff(inputs: Record<string, any>): CrewAIResult;
}

/**
 * Convert a CrewAI class to an MCP tool.
 */
export function createCrewAIAdapter(
  agentInstance: CrewAIAgent,
  name: string,
  description: string,
  inputSchema: SchemaLike
): (...args: any[]) => ToolResult {
  const runAgent = (...args: any[]): ToolResult => {
    const kwargs = extractParamsFromArgs(args, inputSchema);
    const parsedInputs = parseInputWithSchema(inputSchema, kwargs);
    const normalizedInputs = parsedInputs && typeof parsedInputs === 'object'
      ? parsedInputs
      : kwargs;

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
      // Execute CrewAI kickoff
      const result = agentInstance.kickoff({ inputs: normalizedInputs });
      const serializedResult = typeof result?.model_dump === 'function'
        ? result.model_dump()
        : result;
      const outputObj = ensureSerializable(serializedResult);
      return {
        content: [{ type: 'text', text: JSON.stringify(outputObj, null, 2) }],
        structuredContent: outputObj
      };
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
 * Create a typed wrapper for CrewAI adapter with specific input schema
 */
export function createTypedCrewAIAdapter<T extends Record<string, any>>(
  agentInstance: CrewAIAgent,
  name: string,
  description: string,
  inputSchema: SchemaLike
): (input: T) => ToolResult {
  const adapter = createCrewAIAdapter(agentInstance, name, description, inputSchema);

  return (input: T): ToolResult => {
    return adapter(input);
  };
}

/**
 * Mock CrewAI result class for testing
 */
export class MockCrewAIResult implements CrewAIResult {
  private data: Record<string, any>;
  
  constructor(data: Record<string, any>) {
    this.data = ensureSerializable(data) as Record<string, any>;
  }
  
  model_dump_json(): string {
    return JSON.stringify(this.data);
  }
  
  model_dump(): Record<string, any> {
    return this.data;
  }
} 