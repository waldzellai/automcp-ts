import { z } from 'zod';

// Define the base types for our adapter system
export interface AgentInstance {
  // This is intentionally generic to accommodate different agent types
  [key: string]: any;
}

export interface InputSchemaType {
  [key: string]: z.ZodType<any>;
}

export interface ToolResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  /** Optional structured JSON output */
  structuredContent?: any;
  /** Optional list of resource links related to the result */
  resource_links?: Array<{
    type?: 'resource_link';
    name: string;
    uri: string;
    description?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface AdapterConfig<T extends InputSchemaType> {
  agentInstance: AgentInstance;
  name: string;
  description: string;
  inputSchema: T;
}

// Base adapter class that provides the foundation for framework-specific adapters
export abstract class BaseAdapter<T extends InputSchemaType> {
  protected agentInstance: AgentInstance;
  protected name: string;
  protected description: string;
  protected inputSchema: T;

  constructor(config: AdapterConfig<T>) {
    this.agentInstance = config.agentInstance;
    this.name = config.name;
    this.description = config.description;
    this.inputSchema = config.inputSchema;
  }

  // Abstract method that framework-specific adapters must implement
  protected abstract executeAgent(inputs: any): Promise<any>;

  // The main tool function that replaces Python's dynamic exec() approach
  public createToolFunction() {
    // Create a schema object from our input schema
    const schemaObject = z.object(this.inputSchema);
    
    // Return a function that validates inputs and executes the agent
    return async (params: any): Promise<ToolResult> => {
      try {
        // Validate inputs using Zod
        const validatedInputs = schemaObject.parse(params);
        
        // Execute the agent with validated inputs
        const result = await this.executeAgent(validatedInputs);
        
        // Ensure the result is serializable
        const serializedResult = this.ensureSerializable(result);

        if (serializedResult && typeof serializedResult === 'object' && 'content' in serializedResult) {
          // If the agent already returned a ToolResult-like object, pass through
          return serializedResult as ToolResult;
        }

        const toolResult: ToolResult = {
          content: [{
            type: "text",
            text: typeof serializedResult === 'string'
              ? serializedResult
              : JSON.stringify(serializedResult, null, 2)
          }]
        };

        if (serializedResult && typeof serializedResult === 'object') {
          toolResult.structuredContent = serializedResult;
          if ('resource_links' in serializedResult) {
            toolResult.resource_links = (serializedResult as any).resource_links;
          }
        }

        return toolResult;
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error executing agent: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    };
  }

  // Helper method to ensure results are serializable
  protected ensureSerializable(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.ensureSerializable(item));
    }
    
    if (typeof obj === 'object') {
      // Handle special objects that might have toJSON or similar methods
      if (typeof obj.toJSON === 'function') {
        return this.ensureSerializable(obj.toJSON());
      }
      
      if (typeof obj.toString === 'function' && obj.constructor !== Object) {
        // For custom objects, use toString unless it's a plain object
        return obj.toString();
      }
      
      // For plain objects, recursively serialize properties
      const serialized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        try {
          serialized[key] = this.ensureSerializable(value);
        } catch (error) {
          // If we can't serialize a property, convert it to string
          serialized[key] = String(value);
        }
      }
      return serialized;
    }
    
    // For anything else, convert to string
    return String(obj);
  }

  // Getters for the tool metadata
  public getName(): string {
    return this.name;
  }

  public getDescription(): string {
    return this.description;
  }

  public getInputSchema(): T {
    return this.inputSchema;
  }
} 