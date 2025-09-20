import { Effect } from 'effect';
import { z } from 'zod';
import {
  ExecutionError,
  SerializationError,
  ToolExecutionError,
  ValidationError
} from './errors.js';

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
      const self = this;

      const program = Effect.gen(function* () {
        const validatedInputs = yield* self.parseParams(schemaObject, params);
        const result = yield* self.executeAgentEffect(validatedInputs);
        const serializedResult = yield* self.serializeResult(result);
        return self.normalizeResult(serializedResult);
      });

      return Effect.runPromise(program).catch(error => self.formatError(error));
    };
  }

  private parseParams(schemaObject: z.ZodObject<T>, params: any) {
    return Effect.try({
      try: () => schemaObject.parse(params),
      catch: (error) => {
        const issues = this.extractZodIssues(error);
        return new ValidationError({
          message: 'Invalid input provided to tool.',
          ...(issues ? { issues } : {}),
          cause: error
        });
      }
    });
  }

  private executeAgentEffect(validatedInputs: any) {
    return Effect.tryPromise({
      try: () => this.executeAgent(validatedInputs),
      catch: (error) =>
        new ExecutionError({
          message: 'The underlying agent threw an error while executing.',
          cause: error
        })
    });
  }

  private serializeResult(result: any) {
    return Effect.try({
      try: () => this.ensureSerializable(result),
      catch: (error) =>
        new SerializationError({
          message: 'Failed to serialize agent result.',
          cause: error
        })
    });
  }

  private normalizeResult(serializedResult: any): ToolResult {
    if (serializedResult && typeof serializedResult === 'object' && 'content' in serializedResult) {
      return serializedResult as ToolResult;
    }

    const toolResult: ToolResult = {
      content: [{
        type: 'text',
        text:
          typeof serializedResult === 'string'
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
  }

  private formatError(error: unknown): ToolResult {
    const message = this.toolErrorMessage(error);

    return {
      content: [
        {
          type: 'text',
          text: message
        }
      ],
      isError: true
    };
  }

  private toolErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && '_tag' in error && 'message' in error) {
      return `${(error as ToolExecutionError)._tag}: ${String((error as ToolExecutionError).message)}`;
    }

    if (error instanceof Error) {
      return `Error executing agent: ${error.message}`;
    }

    return `Error executing agent: ${String(error)}`;
  }

  private extractZodIssues(error: unknown): readonly string[] | undefined {
    if (error instanceof z.ZodError) {
      return error.issues.map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    return undefined;
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