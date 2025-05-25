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

interface RunnerResult {
  final_output: any;
}

interface Runner {
  run(agentInstance: any, ...args: any[]): Promise<RunnerResult>;
}

// Mock Runner implementation - would need to be replaced with actual agents library equivalent
const MockRunner: Runner = {
  async run(agentInstance: any, ...args: any[]): Promise<RunnerResult> {
    // This would need to be implemented based on the actual agents library
    // For now, returning a mock result
    return { final_output: "Mock result" };
  }
};

/**
 * Convert OpenAI agents to an MCP tool
 */
export function createOpenAIAdapter(
  agentInstance: any,
  name: string,
  description: string,
  inputSchema: ModelClass,
  runner: Runner = MockRunner
): (...args: any[]) => Promise<any> {
  const runAgent = async (...args: any[]): Promise<any> => {
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
      // Run the agent with input values
      const result = await runner.run(agentInstance, ...Object.values(inputDict));
      return result.final_output;
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
 * Create a typed wrapper for OpenAI adapter with specific input schema
 */
export function createTypedOpenAIAdapter<T extends BaseModel>(
  agentInstance: any,
  name: string,
  description: string,
  inputSchema: ModelClass,
  runner?: Runner
): (input: T) => Promise<any> {
  const adapter = createOpenAIAdapter(agentInstance, name, description, inputSchema, runner);
  
  return async (input: T): Promise<any> => {
    return await adapter(input);
  };
} 