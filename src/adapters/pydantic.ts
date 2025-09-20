import { ToolResult } from './base.js';
import { ensureSerializable, extractParamsFromArgs, parseInputWithSchema, type SchemaLike } from './utils.js';

interface BaseModel {
  [key: string]: any;
  query?: string;
}

interface FieldInfo {
  annotation?: any;
  required?: boolean;
  default?: any;
}

interface AgentResult {
  data?: any;
  raw?: any;
}

interface PydanticAgent {
  run(query: string): Promise<AgentResult | any>;
}

/**
 * Convert a Pydantic agent instance to an MCP tool, making it async.
 */
export function createPydanticAdapter(
  agentInstance: PydanticAgent,
  name: string,
  description: string,
  inputSchema: SchemaLike
): (...args: any[]) => Promise<ToolResult> {
  const runAgent = async (...args: any[]): Promise<ToolResult> => {
    const kwargs = extractParamsFromArgs(args, inputSchema);
    const parsedInput = parseInputWithSchema(inputSchema, kwargs);

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
      // Call the async run method
      const queryInput = parsedInput && typeof parsedInput === 'object'
        ? (parsedInput as Record<string, any>).query ?? parsedInput
        : parsedInput;
      const result = await agentInstance.run(
        typeof queryInput === 'string' ? queryInput : JSON.stringify(queryInput)
      );

      let output: any = result;

      if (result && typeof result === 'object') {
        if ('data' in result) {
          output = result.data;
        } else if ('raw' in result) {
          output = result.raw;
        }
      }

      const serialized = ensureSerializable(output);

      if (serialized && typeof serialized === 'object') {
        return {
          content: [{ type: 'text', text: JSON.stringify(serialized, null, 2) }],
          structuredContent: serialized
        };
      }

      return {
        content: [{ type: 'text', text: String(serialized) }]
      };
    } finally {
      // Restore original console methods
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  };
  
  // Add metadata
  Object.defineProperty(runAgent, 'name', { value: name });
  Object.defineProperty(runAgent, 'description', { value: description });
  
  return runAgent;
}

/**
 * Create a typed wrapper for Pydantic adapter with specific input schema
 */
export function createTypedPydanticAdapter<T extends BaseModel>(
  agentInstance: PydanticAgent,
  name: string,
  description: string,
  inputSchema: SchemaLike
): (input: T) => Promise<ToolResult> {
  const adapter = createPydanticAdapter(agentInstance, name, description, inputSchema);

  return async (input: T): Promise<ToolResult> => {
    return await adapter(input);
  };
}

/**
 * Helper function to create a Pydantic-like model class
 */
export function createModel<T extends Record<string, any>>(
  fields: Record<keyof T, FieldInfo>
) {
  return class PydanticModel implements BaseModel {
    [key: string]: any;

    constructor(data: Partial<T>) {
      Object.assign(this, data);
      
      // Validate required fields
      for (const [fieldName, fieldInfo] of Object.entries(fields)) {
        if (fieldInfo.required && !(fieldName in data)) {
          throw new Error(`Field '${fieldName}' is required`);
        }
        if (!(fieldName in data) && fieldInfo.default !== undefined) {
          this[fieldName] = fieldInfo.default;
        }
      }
    }
    
    static model_fields = fields;
  };
} 