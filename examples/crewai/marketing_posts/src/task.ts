import { Agent } from './agent.js';
import { TaskConfig, AgentResult } from './types.js';
import { promises as fs } from 'fs';

export class Task {
  private config: TaskConfig;
  private agent?: Agent;
  private contextTasks: Task[] = [];

  constructor(config: TaskConfig, agent?: Agent) {
    this.config = config;
    this.agent = agent;
  }

  setAgent(agent: Agent): void {
    this.agent = agent;
  }

  setContext(tasks: Task[]): void {
    this.contextTasks = tasks;
  }

  get description(): string {
    return this.config.description;
  }

  get expectedOutput(): string {
    return this.config.expected_output;
  }

  get outputFile(): string | undefined {
    return this.config.output_file;
  }

  get outputJson(): any {
    return this.config.output_json;
  }

  async execute(inputs: Record<string, any> = {}): Promise<AgentResult> {
    if (!this.agent) {
      throw new Error('No agent assigned to this task');
    }

    // Gather context from previous tasks
    const context: string[] = [];
    for (const task of this.contextTasks) {
      if (task.lastResult) {
        const contextInfo = `From ${task.lastResult.agent_role}: ${task.lastResult.raw_output}`;
        context.push(contextInfo);
      }
    }

    let result: AgentResult;

    // Execute with structured output if specified
    if (this.config.output_json) {
      result = await this.agent.executeTaskWithStructuredOutput(
        this.config.description,
        this.config.expected_output,
        this.config.output_json,
        context,
        inputs
      );
    } else {
      result = await this.agent.executeTask(
        this.config.description,
        this.config.expected_output,
        context,
        inputs
      );
    }

    // Save to file if specified
    if (this.config.output_file) {
      try {
        const outputContent = typeof result.output === 'string' 
          ? result.output 
          : JSON.stringify(result.output, null, 2);
        
        await fs.writeFile(this.config.output_file, outputContent, 'utf8');
        console.log(`📄 Output saved to ${this.config.output_file}`);
      } catch (error) {
        console.error(`❌ Failed to save output to file: ${error}`);
      }
    }

    this.lastResult = result;
    return result;
  }

  private lastResult?: AgentResult;

  getLastResult(): AgentResult | undefined {
    return this.lastResult;
  }
} 