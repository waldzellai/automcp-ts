interface BaseModel {
  [key: string]: any;
}

interface FieldInfo {
  annotation?: any;
  required?: boolean;
  default?: any;
}

interface ModelClass {
  new (data: any): BaseModel;
  modelFields?: Record<string, FieldInfo>;
}

interface AgentInstance {
  attach_llm(llm: any): Promise<any>;
}

interface LLMInstance {
  generate_str(query: string): Promise<string>;
}

type AppInitializeFn = (app: any) => Promise<void>;

/**
 * Convert a MCP agent instance to an MCP tool with proper isolation from MCP's task management.
 */
export function createMcpAgentAdapter(
  agentInstance: AgentInstance,
  llm: any,
  app: any,
  appInitializeFn: AppInitializeFn,
  name: string,
  description: string,
  inputSchema: ModelClass
): (...args: any[]) => Promise<any> {
  // Define the wrapper function
  const runAgent = async (...args: any[]): Promise<any> => {
    // Convert args to object based on schema (simplified approach)
    const kwargs: Record<string, any> = {};
    if (args.length === 1 && typeof args[0] === 'object') {
      Object.assign(kwargs, args[0]);
    }
    
    // Create input object from schema
    const inputData = new inputSchema(kwargs);
    
    // Create a promise that we can use to communicate between tasks
    let resolveResult: (value: any) => void;
    let rejectResult: (reason: any) => void;
    const resultPromise = new Promise<any>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    
    const isolatedAgentTask = async (): Promise<void> => {
      try {
        // Initialize the app
        await appInitializeFn(app);
        
        // Attach LLM to the agent
        const llmInstance: LLMInstance = await agentInstance.attach_llm(llm);
        
        // Execute the main operation
        const response = await llmInstance.generate_str((inputData as any).query);
        
        // Set the result
        resolveResult(response);
      } catch (error) {
        // Set exception
        rejectResult(error);
      }
    };
    
    // Start the agent task
    const taskPromise = isolatedAgentTask();
    
    try {
      // Wait for the result or an exception
      const result = await Promise.race([
        resultPromise,
        taskPromise.then(() => resultPromise) // Ensure we wait for the task to complete
      ]);
      return result;
    } catch (error) {
      // Log any exceptions but don't re-raise unless it's a cancellation
      if (error instanceof Error) {
        console.error('Agent execution error:', error.stack || error.message);
        return { status: 'error', message: error.message };
      }
      throw error;
    }
  };
  
  // Set function metadata
  Object.defineProperty(runAgent, 'name', { value: name });
  Object.defineProperty(runAgent, 'description', { value: description });
  
  return runAgent;
}

/**
 * Helper function to create a schema-based function signature
 */
export function createSchemaFunction<T extends BaseModel>(
  schema: ModelClass,
  implementation: (input: T) => Promise<any>
): (data: any) => Promise<any> {
  return async (data: any) => {
    const input = new schema(data) as T;
    return await implementation(input);
  };
} 