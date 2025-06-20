import { ToolResult } from './base.js';
import { ensureSerializable } from './utils.js';

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

interface LlamaIndexContext {
  agentInstance: any;
  [key: string]: any;
}

interface LlamaIndexAgent {
  run(...args: any[]): Promise<any>;
}

// Mock Context implementation - would need to be replaced with actual LlamaIndex equivalent
class MockContext implements LlamaIndexContext {
  agentInstance: any;
  
  constructor(agentInstance: any) {
    this.agentInstance = agentInstance;
  }
}

/**
 * Convert LlamaIndex agents to an MCP tool
 */
export function createLlamaIndexAdapter(
  agentInstance: LlamaIndexAgent,
  name: string,
  description: string,
  inputSchema: ModelClass,
  ContextClass: new (agent: any) => LlamaIndexContext = MockContext
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
    
    // Create input object from schema
    const inputData = new inputSchema(kwargs);
    const inputDict = inputData.model_dump();
    const ctx = new ContextClass(agentInstance);
    
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
      // Run the agent with input values and context
      const inputValues = Object.values(inputDict);
      const response = await agentInstance.run(...inputValues);
      if (response && typeof response === 'object') {
        const output = ensureSerializable(response);
        return {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      }
      return { content: [{ type: 'text', text: String(response) }] };
    } finally {
      // Restore original console methods
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  };
  
  // Set function metadata
  Object.defineProperty(runAgent, 'name', { value: name });
  Object.defineProperty(runAgent, 'description', { value: description });
  
  return runAgent;
}

/**
 * Create a typed wrapper for LlamaIndex adapter with specific input schema
 */
export function createTypedLlamaIndexAdapter<T extends BaseModel>(
  agentInstance: LlamaIndexAgent,
  name: string,
  description: string,
  inputSchema: ModelClass,
  ContextClass?: new (agent: any) => LlamaIndexContext
): (input: T) => Promise<ToolResult> {
  const adapter = createLlamaIndexAdapter(agentInstance, name, description, inputSchema, ContextClass);

  return async (input: T): Promise<ToolResult> => {
    return await adapter(input);
  };
}

/**
 * Create a LlamaIndex-style context
 */
export function createContext(agentInstance: any): LlamaIndexContext {
  return new MockContext(agentInstance);
} 