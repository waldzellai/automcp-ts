#!/usr/bin/env node

import { StateGraph, END, START } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

// Define the state schema
const ReflectionStateSchema = z.object({
  query: z.string(),
  messages: z.array(z.any()).default([]),
});

type ReflectionState = z.infer<typeof ReflectionStateSchema>;

export class ReflectionAgent {
  private llm: ChatOpenAI;
  private maxIterations: number;
  private graph: any;
  private generatePrompt: ChatPromptTemplate;
  private reflectionPrompt: ChatPromptTemplate;

  constructor(openaiModel: string = "gpt-4o-mini", maxIterations: number = 3) {
    this.llm = new ChatOpenAI({
      modelName: openaiModel,
      temperature: 0.1,
    });
    this.maxIterations = maxIterations;

    // Set up generation prompt and chain
    this.generatePrompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        "You are an essay assistant tasked with writing excellent 5-paragraph essays. " +
        "Generate the best essay possible for the user's request. " +
        "If the user provides critique, respond with a revised version of your previous attempts."
      ],
      new MessagesPlaceholder("messages"),
    ]);

    // Set up reflection prompt and chain
    this.reflectionPrompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        "You are a teacher grading an essay submission. Generate critique and recommendations for the user's submission. " +
        "Provide detailed recommendations, including requests for length, depth, style, etc."
      ],
      new MessagesPlaceholder("messages"),
    ]);

    this.initializeGraph();
  }

  private async generationNode(state: ReflectionState): Promise<Partial<ReflectionState>> {
    console.log("✍️ Generating essay content...");
    
    const messages = state.messages || [];
    
    // If messages is empty, create a new message from query
    let inputMessages: BaseMessage[];
    if (messages.length === 0) {
      inputMessages = [new HumanMessage(state.query)];
    } else {
      inputMessages = messages;
    }

    // Generate response using the prompt template
    const chain = this.generatePrompt.pipe(this.llm);
    const response = await chain.invoke({ messages: inputMessages });

    // Add the new AI message to the existing messages
    const updatedMessages = [...messages, response];
    
    return { messages: updatedMessages };
  }

  private async reflectionNode(state: ReflectionState): Promise<Partial<ReflectionState>> {
    console.log("🔍 Reflecting on the essay...");
    
    const messages = state.messages || [];
    
    // Get the last AI message for reflection (the essay to critique)
    const aiMessages = messages.filter(msg => msg instanceof AIMessage);
    if (aiMessages.length === 0) {
      // Should never happen but just in case
      return { messages };
    }

    const lastEssay = aiMessages[aiMessages.length - 1];

    // For the reflection, we need a message with the essay to critique
    const reflectionInput = [new HumanMessage(lastEssay.content as string)];

    // Generate reflection using the reflection prompt template
    const chain = this.reflectionPrompt.pipe(this.llm);
    const reflection = await chain.invoke({ messages: reflectionInput });

    // Add the reflection as a human message to the existing messages
    const updatedMessages = [...messages, new HumanMessage(reflection.content as string)];
    
    return { messages: updatedMessages };
  }

  private shouldContinue(state: ReflectionState): string {
    const messages = state.messages || [];
    if (messages.length >= this.maxIterations * 2) { // Each iteration adds 2 messages (AI + Human)
      return END;
    }
    return "reflect";
  }

  private initializeGraph(): void {
    // Create the state graph
    const graph = new StateGraph(ReflectionStateSchema);

    // Add nodes
    graph.addNode("generate", this.generationNode.bind(this));
    graph.addNode("reflect", this.reflectionNode.bind(this));

    // Add edges
    graph.addEdge(START, "generate");
    graph.addConditionalEdges("generate", this.shouldContinue.bind(this));
    graph.addEdge("reflect", "generate");

    // Compile the graph
    this.graph = graph.compile();
  }

  getAgent() {
    return this.graph;
  }

  async invoke(input: ReflectionState): Promise<ReflectionState> {
    console.log("🚀 Starting Reflection Agent...\n");
    const startTime = Date.now();
    
    const result = await this.graph.invoke(input);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`✅ Reflection completed in ${duration.toFixed(2)} seconds!\n`);
    return result;
  }

  // Method to get the final essay from the messages
  getFinalEssay(result: ReflectionState): string {
    const messages = result.messages || [];
    const aiMessages = messages.filter(msg => msg instanceof AIMessage);
    
    if (aiMessages.length > 0) {
      const lastEssay = aiMessages[aiMessages.length - 1];
      return lastEssay.content as string;
    }
    
    return "No essay generated.";
  }

  // Method to get all reflections from the messages
  getReflections(result: ReflectionState): string[] {
    const messages = result.messages || [];
    const reflections: string[] = [];
    
    // Skip the first human message (the query) and look for subsequent human messages (reflections)
    for (let i = 1; i < messages.length; i++) {
      const msg = messages[i];
      if (msg instanceof HumanMessage) {
        reflections.push(msg.content as string);
      }
    }
    
    return reflections;
  }
}

// Example usage
async function main(): Promise<void> {
  const reflectionAgent = new ReflectionAgent("gpt-4o-mini", 3);

  const initialState: ReflectionState = {
    query: "Write an essay on the topicality of The Little Prince and its message in modern life",
    messages: [],
  };

  try {
    console.log("🎯 Essay Topic:", initialState.query);
    console.log("=" .repeat(50));
    
    const finalState = await reflectionAgent.invoke(initialState);
    
    // Display results
    console.log("📝 FINAL ESSAY:");
    console.log("=" .repeat(50));
    console.log(reflectionAgent.getFinalEssay(finalState));
    
    const reflections = reflectionAgent.getReflections(finalState);
    if (reflections.length > 0) {
      console.log("\n🔍 REFLECTION FEEDBACK:");
      console.log("=" .repeat(50));
      reflections.forEach((reflection, index) => {
        console.log(`\nReflection ${index + 1}:`);
        console.log(reflection);
      });
    }
    
    console.log("\n📊 STATISTICS:");
    console.log("=" .repeat(50));
    console.log(`Total messages: ${finalState.messages?.length || 0}`);
    console.log(`Iterations completed: ${Math.floor((finalState.messages?.length || 0) / 2)}`);
    console.log(`Reflection rounds: ${reflections.length}`);

  } catch (error) {
    console.error("❌ Error running Reflection Agent:", error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 