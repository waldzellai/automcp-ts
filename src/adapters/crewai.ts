import { ensureSerializable } from './utils.js';
import { ToolResult } from './base.js';

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
  inputSchema: ModelClass
): (...args: any[]) => ToolResult {
  const runAgent = (...args: any[]): ToolResult => {
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
    const inputs = new inputSchema(kwargs);
    
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
      const result = agentInstance.kickoff({ inputs: inputs.model_dump() });
      const outputObj = ensureSerializable(result.model_dump());
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
export function createTypedCrewAIAdapter<T extends BaseModel>(
  agentInstance: CrewAIAgent,
  name: string,
  description: string,
  inputSchema: ModelClass
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