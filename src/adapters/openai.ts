import { ToolResult } from './base.js';
import { ensureSerializable, extractParamsFromArgs, parseInputWithSchema, type SchemaLike } from './utils.js';

interface BaseModel {
  [key: string]: any;
}

interface RunnerResult {
  final_output: any;
}

interface Runner {
  run(agentInstance: any, params: Record<string, any>): Promise<RunnerResult>;
}

// Default Runner: tries common method names or treats agent as a function
const DefaultRunner: Runner = {
  async run(agentInstance: any, params: Record<string, any>): Promise<RunnerResult> {
    // If agent is a function, call it directly
    if (typeof agentInstance === 'function') {
      const out = await agentInstance(params);
      return { final_output: out };
    }

    // Common method names
    const methods = ['run', 'invoke', 'call', 'execute'];
    for (const m of methods) {
      if (typeof agentInstance?.[m] === 'function') {
        const out = await agentInstance[m](params);
        return { final_output: out };
      }
    }

    // If agent exposes OpenAI client, expect a { model, messages } payload
    if (agentInstance?.chat?.completions?.create) {
      const out = await agentInstance.chat.completions.create(params);
      return { final_output: out };
    }

    throw new Error('Unsupported OpenAI agent type: provide a custom runner or a callable agent');
  }
};

/**
 * Convert OpenAI agents/utilities to an MCP tool
 */
export function createOpenAIAdapter(
  agentInstance: any,
  name: string,
  description: string,
  inputSchema?: SchemaLike,
  runner: Runner = DefaultRunner
): (...args: any[]) => Promise<ToolResult> {
  const runAgent = async (...args: any[]): Promise<ToolResult> => {
    const params = extractParamsFromArgs(args, inputSchema);
    const parsedParams = parseInputWithSchema(inputSchema, params);
    const effectiveParams = parsedParams && typeof parsedParams === 'object'
      ? parsedParams
      : params;

    // Capture console output to avoid interfering with transports
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};

    try {
      const result = await runner.run(agentInstance, effectiveParams);
      const output = ensureSerializable(result.final_output);
      if (output && typeof output === 'object') {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(output, null, 2)
          }],
          structuredContent: output
        };
      }
      return {
        content: [{ type: 'text', text: String(output) }]
      };
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
 * Create a typed wrapper for OpenAI adapter with specific input schema
 */
export function createTypedOpenAIAdapter<T extends BaseModel>(
  agentInstance: any,
  name: string,
  description: string,
  inputSchema?: SchemaLike,
  runner?: Runner
): (input: T) => Promise<ToolResult> {
  const adapter = createOpenAIAdapter(agentInstance, name, description, inputSchema, runner);

  return async (input: T): Promise<ToolResult> => {
    return await adapter(input);
  };
}
