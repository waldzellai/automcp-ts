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
  inputSchema?: ModelClass,
  runner: Runner = DefaultRunner
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

    // Capture console output to avoid interfering with transports
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};

    try {
      const result = await runner.run(agentInstance, params);
      const output = result.final_output;
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
  inputSchema?: ModelClass,
  runner?: Runner
): (input: T) => Promise<ToolResult> {
  const adapter = createOpenAIAdapter(agentInstance, name, description, inputSchema, runner);

  return async (input: T): Promise<ToolResult> => {
    return await adapter(input);
  };
}
