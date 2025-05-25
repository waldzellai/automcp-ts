import { BaseAdapter, AgentInstance, InputSchemaType, AdapterConfig } from './base.js';
import { z } from 'zod';

// Express.js specific agent interface
export interface ExpressAgent extends AgentInstance {
  handleRequest?: (inputs: any) => Promise<any> | any;
  processInputs?: (inputs: any) => Promise<any> | any;
  execute?: (inputs: any) => Promise<any> | any;
  run?: (inputs: any) => Promise<any> | any;
}

// Express adapter that extends the base adapter
export class ExpressAdapter<T extends InputSchemaType> extends BaseAdapter<T> {
  constructor(config: AdapterConfig<T>) {
    super(config);
  }

  protected async executeAgent(inputs: any): Promise<any> {
    const agent = this.agentInstance as ExpressAgent;
    
    // Try different common method names for Express.js agents
    if (typeof agent.handleRequest === 'function') {
      return await agent.handleRequest(inputs);
    }
    
    if (typeof agent.processInputs === 'function') {
      return await agent.processInputs(inputs);
    }
    
    if (typeof agent.execute === 'function') {
      return await agent.execute(inputs);
    }
    
    if (typeof agent.run === 'function') {
      return await agent.run(inputs);
    }
    
    // If no standard method found, throw an error
    throw new Error(
      'Express agent must implement one of: handleRequest, processInputs, execute, or run methods'
    );
  }
}

// Factory function that creates an Express adapter (equivalent to Python's create_express_adapter)
export function createExpressAdapter<T extends InputSchemaType>(config: {
  agentInstance: ExpressAgent;
  name: string;
  description: string;
  inputSchema: T;
}) {
  const adapter = new ExpressAdapter(config);
  
  // Return the tool function that can be used with MCP
  return adapter.createToolFunction();
}

// Example usage and type definitions
export interface ExampleExpressInputs {
  endpoint: z.ZodString;
  method: z.ZodEnum<['GET', 'POST', 'PUT', 'DELETE']>;
  data?: z.ZodOptional<z.ZodRecord<z.ZodAny>>;
}

// Example input schema for Express endpoints
export const exampleExpressInputSchema = {
  endpoint: z.string().describe('The API endpoint to call'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).describe('HTTP method'),
  data: z.record(z.any()).optional().describe('Request data/body')
};

// Example Express agent class
export class ExampleExpressAgent implements ExpressAgent {
  async handleRequest(inputs: { endpoint: string; method: string; data?: any }) {
    // Simulate an Express.js application handling a request
    const { endpoint, method, data } = inputs;
    
    // Mock response based on the inputs
    const response = {
      status: 200,
      endpoint,
      method,
      timestamp: new Date().toISOString(),
      data: data || null,
      message: `Successfully processed ${method} request to ${endpoint}`
    };
    
    // Simulate some async processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return response;
  }
} 