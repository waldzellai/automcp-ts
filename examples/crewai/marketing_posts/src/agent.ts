import OpenAI from 'openai';
import { AgentConfig, Tool, AgentResult } from './types.js';

export class Agent {
  private config: AgentConfig;
  private tools: Tool[];
  private openai: OpenAI;

  constructor(config: AgentConfig, tools: Tool[] = []) {
    this.config = config;
    this.tools = [...tools, ...(config.tools || [])];
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  get role(): string {
    return this.config.role;
  }

  get goal(): string {
    return this.config.goal;
  }

  get backstory(): string {
    return this.config.backstory;
  }

  private createSystemPrompt(): string {
    return `You are ${this.config.role}.

GOAL: ${this.config.goal}

BACKSTORY: ${this.config.backstory}

You are working as part of a team of AI agents. Each agent has a specific role and goal. 
Your job is to execute tasks according to your role and expertise.

${this.tools.length > 0 ? `\nAvailable tools: ${this.tools.map(t => `${t.name}: ${t.description}`).join(', ')}` : ''}

Always provide detailed, professional output that matches your role's expertise.
Focus on quality and actionable insights.`;
  }

  async executeTask(
    taskDescription: string,
    expectedOutput: string,
    context: string[] = [],
    inputs: Record<string, any> = {}
  ): Promise<AgentResult> {
    const startTime = Date.now();
    
    if (this.config.verbose) {
      console.log(`\n🤖 Agent ${this.config.role} starting task...`);
      console.log(`Task: ${taskDescription}`);
    }

    try {
      // Interpolate variables in task description
      let processedDescription = taskDescription;
      let processedExpectedOutput = expectedOutput;
      
      for (const [key, value] of Object.entries(inputs)) {
        const placeholder = `{${key}}`;
        processedDescription = processedDescription.replace(new RegExp(placeholder, 'g'), value);
        processedExpectedOutput = processedExpectedOutput.replace(new RegExp(placeholder, 'g'), value);
      }

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: this.createSystemPrompt()
        }
      ];

      // Add context from other tasks
      if (context.length > 0) {
        messages.push({
          role: 'user',
          content: `Context from previous tasks:\n${context.join('\n\n')}`
        });
      }

      messages.push({
        role: 'user',
        content: `Task: ${processedDescription}\n\nExpected Output: ${processedExpectedOutput}\n\nPlease complete this task according to your role and expertise.`
      });

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.1,
        max_tokens: 2000,
      });

      const output = completion.choices[0]?.message?.content || '';
      const executionTime = Date.now() - startTime;

      if (this.config.verbose) {
        console.log(`✅ Agent ${this.config.role} completed task in ${executionTime}ms`);
        console.log(`Output preview: ${output.substring(0, 100)}...`);
      }

      return {
        task_id: `task_${Date.now()}`,
        agent_role: this.config.role,
        output,
        raw_output: output,
        execution_time: executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = `Error executing task: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      if (this.config.verbose) {
        console.error(`❌ Agent ${this.config.role} failed task:`, errorMessage);
      }

      return {
        task_id: `task_${Date.now()}`,
        agent_role: this.config.role,
        output: errorMessage,
        raw_output: errorMessage,
        execution_time: executionTime
      };
    }
  }

  async executeTaskWithStructuredOutput(
    taskDescription: string,
    expectedOutput: string,
    outputSchema: any,
    context: string[] = [],
    inputs: Record<string, any> = {}
  ): Promise<AgentResult> {
    const result = await this.executeTask(taskDescription, expectedOutput, context, inputs);
    
    try {
      // Try to parse the output as JSON for structured output
      const jsonMatch = result.output.match(/```json\n([\s\S]*?)\n```/) || 
                       result.output.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsedOutput = JSON.parse(jsonStr);
        const validatedOutput = outputSchema.parse(parsedOutput);
        
        result.output = validatedOutput;
      } else {
        // If no JSON found, try to extract structured data from text
        const structuredPrompt = `Based on the following text, extract and format the information as JSON according to this schema:

Schema: ${JSON.stringify(outputSchema._def, null, 2)}

Text: ${result.output}

Return only valid JSON:`;

        const structuredCompletion = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are a data extraction assistant. Return only valid JSON.' },
            { role: 'user', content: structuredPrompt }
          ],
          temperature: 0,
        });

        const structuredOutput = structuredCompletion.choices[0]?.message?.content || '{}';
        const parsedOutput = JSON.parse(structuredOutput);
        const validatedOutput = outputSchema.parse(parsedOutput);
        
        result.output = validatedOutput;
      }
    } catch (error) {
      if (this.config.verbose) {
        console.warn(`⚠️ Could not parse structured output for ${this.config.role}:`, error);
      }
      // Keep original output if parsing fails
    }

    return result;
  }
} 