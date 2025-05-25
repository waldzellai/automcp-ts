import { Agent } from './agent.js';
import { Task } from './task.js';
import { ProcessType, CrewResult, AgentResult } from './types.js';

export class Crew {
  private agents: Agent[];
  private tasks: Task[];
  private process: ProcessType;
  private verbose: boolean;

  constructor(config: {
    agents: Agent[];
    tasks: Task[];
    process?: ProcessType;
    verbose?: boolean;
  }) {
    this.agents = config.agents;
    this.tasks = config.tasks;
    this.process = config.process || ProcessType.SEQUENTIAL;
    this.verbose = config.verbose || false;
  }

  async kickoff(inputs: Record<string, any> = {}): Promise<CrewResult> {
    if (this.verbose) {
      console.log('\n🚀 Starting Crew execution...');
      console.log(`Process: ${this.process}`);
      console.log(`Agents: ${this.agents.map(a => a.role).join(', ')}`);
      console.log(`Tasks: ${this.tasks.length}`);
      console.log('===================================\n');
    }

    const startTime = Date.now();
    let tasksOutput: AgentResult[] = [];

    try {
      if (this.process === ProcessType.SEQUENTIAL) {
        tasksOutput = await this.executeSequential(inputs);
      } else if (this.process === ProcessType.HIERARCHICAL) {
        tasksOutput = await this.executeHierarchical(inputs);
      }

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      if (this.verbose) {
        console.log('\n===================================');
        console.log(`✅ Crew execution completed in ${executionTime}ms`);
        console.log(`Total tasks completed: ${tasksOutput.length}`);
      }

      // Create final result
      const finalOutput = tasksOutput[tasksOutput.length - 1];
      const result: CrewResult = {
        tasks_output: tasksOutput,
        raw: finalOutput?.raw_output || '',
        pydantic: finalOutput?.output,
        json_dict: this.convertToJsonDict(finalOutput?.output),
        usage_metrics: this.calculateUsageMetrics(tasksOutput)
      };

      return result;

    } catch (error) {
      const errorMessage = `Crew execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      if (this.verbose) {
        console.error(`❌ ${errorMessage}`);
      }

      return {
        tasks_output: tasksOutput,
        raw: errorMessage,
        pydantic: null,
        json_dict: {},
        usage_metrics: this.calculateUsageMetrics(tasksOutput)
      };
    }
  }

  private async executeSequential(inputs: Record<string, any>): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.tasks[i];
      
      if (this.verbose) {
        console.log(`\n📋 Executing Task ${i + 1}/${this.tasks.length}`);
        console.log(`Description: ${task.description}`);
      }

      // Set context from previous tasks
      if (i > 0) {
        task.setContext(this.tasks.slice(0, i));
      }

      const result = await task.execute(inputs);
      results.push(result);

      if (this.verbose) {
        console.log(`✅ Task ${i + 1} completed by ${result.agent_role}`);
      }
    }

    return results;
  }

  private async executeHierarchical(inputs: Record<string, any>): Promise<AgentResult[]> {
    // For hierarchical execution, we would implement a manager agent
    // For now, fall back to sequential execution
    if (this.verbose) {
      console.log('📝 Hierarchical process not fully implemented, using sequential');
    }
    return this.executeSequential(inputs);
  }

  private convertToJsonDict(output: any): Record<string, any> {
    if (typeof output === 'object' && output !== null) {
      return output;
    }
    try {
      return JSON.parse(output);
    } catch {
      return { raw_output: output };
    }
  }

  private calculateUsageMetrics(tasksOutput: AgentResult[]): {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    successful_requests: number;
  } {
    // In a real implementation, we would track actual token usage
    // For now, provide estimated metrics
    const successful_requests = tasksOutput.filter(r => !r.raw_output.includes('Error')).length;
    const estimated_tokens_per_task = 1000;
    
    return {
      total_tokens: tasksOutput.length * estimated_tokens_per_task,
      prompt_tokens: Math.floor(tasksOutput.length * estimated_tokens_per_task * 0.3),
      completion_tokens: Math.floor(tasksOutput.length * estimated_tokens_per_task * 0.7),
      successful_requests
    };
  }

  // Methods for accessing crew configuration
  get agentsList(): Agent[] {
    return this.agents;
  }

  get tasksList(): Task[] {
    return this.tasks;
  }

  // Model dump functionality similar to Pydantic
  modelDumpJson(): string {
    const crewData = {
      agents: this.agents.map(agent => ({
        role: agent.role,
        goal: agent.goal,
        backstory: agent.backstory
      })),
      tasks: this.tasks.map(task => ({
        description: task.description,
        expected_output: task.expectedOutput,
        output_file: task.outputFile
      })),
      process: this.process,
      verbose: this.verbose
    };

    return JSON.stringify(crewData, null, 2);
  }
} 