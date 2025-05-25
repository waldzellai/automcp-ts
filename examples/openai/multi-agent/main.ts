import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();

/**
 * This example shows the agents-as-tools pattern. The frontline agent receives a user message and
 * then picks which agents to call, as tools. In this case, it picks from a set of translation
 * agents.
 */

// TypeScript interfaces for better type safety
interface AgentConfig {
  name: string;
  instructions: string;
  handoffDescription: string;
}

interface ToolConfig {
  toolName: string;
  toolDescription: string;
}

class Agent {
  private client: OpenAI;
  private name: string;
  private instructions: string;
  private handoffDescription: string;

  constructor(config: AgentConfig) {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.name = config.name;
    this.instructions = config.instructions;
    this.handoffDescription = config.handoffDescription;
  }

  // Convert Python method to TypeScript
  async run(message: string): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: this.instructions,
          },
          {
            role: 'user',
            content: message,
          },
        ],
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content || 'No response generated';
    } catch (error) {
      throw new Error(`Agent ${this.name} failed: ${error}`);
    }
  }

  // Convert Python as_tool method to TypeScript
  asTool(config: ToolConfig): OpenAI.Chat.Completions.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: config.toolName,
        description: config.toolDescription,
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The message to translate',
            },
          },
          required: ['message'],
        },
      },
    };
  }

  getName(): string {
    return this.name;
  }

  getHandoffDescription(): string {
    return this.handoffDescription;
  }
}

class Runner {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Convert Python static method to TypeScript
  static async run(orchestratorAgent: Agent, message: string): Promise<{ finalOutput: string }> {
    const runner = new Runner();
    return runner.runAgent(orchestratorAgent, message);
  }

  private async runAgent(agent: Agent, message: string): Promise<{ finalOutput: string }> {
    try {
      const result = await agent.run(message);
      return { finalOutput: result };
    } catch (error) {
      throw new Error(`Runner failed: ${error}`);
    }
  }
}

class TranslatorAgent {
  private spanishAgent: Agent;
  private frenchAgent: Agent;
  private italianAgent: Agent;
  private orchestratorAgent: Agent;

  constructor() {
    this.initializeAgents();
  }

  private initializeTranslatorAgents(): void {
    this.spanishAgent = new Agent({
      name: 'spanish_agent',
      instructions: 'You translate the user\'s message to Spanish',
      handoffDescription: 'An english to spanish translator',
    });

    this.frenchAgent = new Agent({
      name: 'french_agent',
      instructions: 'You translate the user\'s message to French',
      handoffDescription: 'An english to french translator',
    });

    this.italianAgent = new Agent({
      name: 'italian_agent',
      instructions: 'You translate the user\'s message to Italian',
      handoffDescription: 'An english to italian translator',
    });
  }

  private initializeOrchestratorAgent(): void {
    this.initializeTranslatorAgents();

    // Create a simplified orchestrator that manages translations
    this.orchestratorAgent = new Agent({
      name: 'orchestrator_agent',
      instructions: `You are a translation orchestrator. You coordinate translation tasks.
        When a user asks for translations, you handle the request by calling the appropriate translation agents.
        If asked for multiple translations, you should indicate which languages you can translate to.
        Available languages: Spanish, French, Italian.
        
        For each translation request, you should:
        1. Identify the target language(s)
        2. Perform the translation
        3. Return the translated text clearly labeled by language`,
      handoffDescription: 'A translation orchestrator that coordinates multiple translation agents',
    });
  }

  private initializeAgents(): void {
    this.initializeOrchestratorAgent();
  }

  getOrchestratorAgent(): Agent {
    return this.orchestratorAgent;
  }

  // Method to handle translation requests more directly in TypeScript
  async processTranslationRequest(message: string, targetLanguages: string[]): Promise<Record<string, string>> {
    const translations: Record<string, string> = {};

    for (const language of targetLanguages) {
      let agent: Agent;
      switch (language.toLowerCase()) {
        case 'spanish':
          agent = this.spanishAgent;
          break;
        case 'french':
          agent = this.frenchAgent;
          break;
        case 'italian':
          agent = this.italianAgent;
          break;
        default:
          throw new Error(`Unsupported language: ${language}`);
      }

      try {
        const translation = await agent.run(message);
        translations[language] = translation;
      } catch (error) {
        translations[language] = `Error translating to ${language}: ${error}`;
      }
    }

    return translations;
  }
}

// Helper function to create readline interface (TypeScript equivalent of Python's input())
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Main function (converted from Python's async main)
async function main(): Promise<void> {
  const rl = createReadlineInterface();

  try {
    const userInput = await askQuestion(
      rl,
      'Hi! What would you like translated, and to which languages? '
    );

    // Run the entire orchestration in a single trace
    const translator = new TranslatorAgent();
    const orchestratorResult = await Runner.run(translator.getOrchestratorAgent(), userInput);
    
    console.log(`Final result: ${orchestratorResult.finalOutput}`);

    // Example of direct translation handling
    if (userInput.toLowerCase().includes('spanish') || 
        userInput.toLowerCase().includes('french') || 
        userInput.toLowerCase().includes('italian')) {
      
      console.log('\n--- Direct Translation Example ---');
      
      // Extract the text to translate (simplified parsing)
      const textMatch = userInput.match(/"([^"]+)"/);
      const textToTranslate = textMatch ? textMatch[1] : 'Hello, how are you?';
      
      // Extract target languages (simplified parsing)
      const targetLanguages: string[] = [];
      if (userInput.toLowerCase().includes('spanish')) targetLanguages.push('Spanish');
      if (userInput.toLowerCase().includes('french')) targetLanguages.push('French');
      if (userInput.toLowerCase().includes('italian')) targetLanguages.push('Italian');
      
      if (targetLanguages.length === 0) {
        targetLanguages.push('Spanish'); // Default
      }

      try {
        const translations = await translator.processTranslationRequest(textToTranslate, targetLanguages);
        
        console.log(`\nTranslations for: "${textToTranslate}"`);
        for (const [language, translation] of Object.entries(translations)) {
          console.log(`${language}: ${translation}`);
        }
      } catch (error) {
        console.error('Translation error:', error);
      }
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Execute if this is the main module (TypeScript equivalent of Python's if __name__ == "__main__")
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { Agent, Runner, TranslatorAgent, type AgentConfig, type ToolConfig }; 