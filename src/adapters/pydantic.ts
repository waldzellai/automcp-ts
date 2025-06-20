import { ToolResult } from './base.js';

interface BaseModel {
  [key: string]: any;
  query?: string;
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
      const result = await agentInstance.run(inputData.query || '');

      let output: any = result;

      if (result && typeof result === 'object') {
        if ('data' in result) {
          output = result.data;
        } else if ('raw' in result) {
          output = result.raw;
        }
      }

      if (output && typeof output === 'object') {
        return {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      }

      return {
        content: [{ type: 'text', text: String(output) }]
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
  inputSchema: ModelClass
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
): ModelClass {
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