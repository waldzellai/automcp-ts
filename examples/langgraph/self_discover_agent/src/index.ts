#!/usr/bin/env node

import { StateGraph, END, START } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { BaseMessage } from '@langchain/core/messages';
import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

// Define the state schema
const SelfDiscoverStateSchema = z.object({
  reasoning_modules: z.string(),
  task_description: z.string(),
  selected_modules: z.string().optional(),
  adapted_modules: z.string().optional(),
  reasoning_structure: z.string().optional(),
  answer: z.string().optional(),
});

type SelfDiscoverState = z.infer<typeof SelfDiscoverStateSchema>;

// Mock prompts (in a real implementation, these would be pulled from LangChain Hub)
const mockPrompts = {
  select: ChatPromptTemplate.fromTemplate(`
You are an expert reasoning module selector. Given a list of reasoning modules and a task, select the most relevant modules for solving the task.

REASONING MODULES:
{reasoning_modules}

TASK:
{task_description}

Select the most relevant reasoning modules for this task. Return only the selected modules, each on a new line.
`),

  adapt: ChatPromptTemplate.fromTemplate(`
You are an expert at adapting reasoning modules to specific tasks. Take the selected modules and adapt them to be more specific and relevant to the given task.

SELECTED MODULES:
{selected_modules}

TASK:
{task_description}

Adapt these modules to be more specific for this task. Return the adapted modules.
`),

  structure: ChatPromptTemplate.fromTemplate(`
You are an expert at creating reasoning structures. Given adapted reasoning modules and a task, create a clear step-by-step reasoning structure.

ADAPTED MODULES:
{adapted_modules}

TASK:
{task_description}

Create a structured reasoning approach using these modules. Return a clear step-by-step structure.
`),

  reasoning: ChatPromptTemplate.fromTemplate(`
You are an expert reasoner. Use the provided reasoning structure to solve the given task step by step.

REASONING STRUCTURE:
{reasoning_structure}

TASK:
{task_description}

Follow the reasoning structure to solve this task. Provide your final answer.
`)
};

export class SelfDiscoverAgent {
  private llm: ChatOpenAI;
  private graph: any;

  constructor(openaiModel: string = "gpt-4o") {
    this.llm = new ChatOpenAI({
      temperature: 0,
      modelName: openaiModel,
    });

    this.initializeGraph();
  }

  private async select(state: SelfDiscoverState): Promise<Partial<SelfDiscoverState>> {
    console.log("📝 Selecting relevant reasoning modules...");
    
    const chain = mockPrompts.select.pipe(this.llm).pipe(new StringOutputParser());
    
    const selectedModules = await chain.invoke({
      reasoning_modules: state.reasoning_modules,
      task_description: state.task_description,
    });

    return { selected_modules: selectedModules };
  }

  private async adapt(state: SelfDiscoverState): Promise<Partial<SelfDiscoverState>> {
    console.log("🔧 Adapting modules to the specific task...");
    
    const chain = mockPrompts.adapt.pipe(this.llm).pipe(new StringOutputParser());
    
    const adaptedModules = await chain.invoke({
      selected_modules: state.selected_modules,
      task_description: state.task_description,
    });

    return { adapted_modules: adaptedModules };
  }

  private async structure(state: SelfDiscoverState): Promise<Partial<SelfDiscoverState>> {
    console.log("🏗️ Creating reasoning structure...");
    
    const chain = mockPrompts.structure.pipe(this.llm).pipe(new StringOutputParser());
    
    const reasoningStructure = await chain.invoke({
      adapted_modules: state.adapted_modules,
      task_description: state.task_description,
    });

    return { reasoning_structure: reasoningStructure };
  }

  private async reason(state: SelfDiscoverState): Promise<Partial<SelfDiscoverState>> {
    console.log("🧠 Applying reasoning to solve the task...");
    
    const chain = mockPrompts.reasoning.pipe(this.llm).pipe(new StringOutputParser());
    
    const answer = await chain.invoke({
      reasoning_structure: state.reasoning_structure,
      task_description: state.task_description,
    });

    return { answer };
  }

  private initializeGraph(): void {
    // Create the state graph
    const graph = new StateGraph(SelfDiscoverStateSchema);

    // Add nodes
    graph.addNode("select", this.select.bind(this));
    graph.addNode("adapt", this.adapt.bind(this));
    graph.addNode("structure", this.structure.bind(this));
    graph.addNode("reason", this.reason.bind(this));

    // Add edges
    graph.addEdge(START, "select");
    graph.addEdge("select", "adapt");
    graph.addEdge("adapt", "structure");
    graph.addEdge("structure", "reason");
    graph.addEdge("reason", END);

    // Compile the graph
    this.graph = graph.compile();
  }

  getAgent() {
    return this.graph;
  }

  async invoke(input: SelfDiscoverState): Promise<SelfDiscoverState> {
    console.log("🚀 Starting Self-Discovery Agent...\n");
    const result = await this.graph.invoke(input);
    console.log("✅ Self-Discovery completed!\n");
    return result;
  }
}

// Example usage
async function main(): Promise<void> {
  // Example reasoning modules
  const reasoningModules = [
    "1. How could I devise an experiment to help solve that problem?",
    "2. Make a list of ideas for solving this problem, and apply them one by one to the problem to see if any progress can be made.",
    "4. How can I simplify the problem so that it is easier to solve?",
    "5. What are the key assumptions underlying this problem?",
    "6. What are the potential risks and drawbacks of each solution?",
    "7. What are the alternative perspectives or viewpoints on this problem?",
    "8. What are the long-term implications of this problem and its solutions?",
    "9. How can I break down this problem into smaller, more manageable parts?",
    "10. Critical Thinking: This style involves analyzing the problem from different perspectives, questioning assumptions, and evaluating the evidence or information available. It focuses on logical reasoning, evidence-based decision-making, and identifying potential biases or flaws in thinking.",
    "11. Try creative thinking, generate innovative and out-of-the-box ideas to solve the problem. Explore unconventional solutions, thinking beyond traditional boundaries, and encouraging imagination and originality.",
    "13. Use systems thinking: Consider the problem as part of a larger system and understanding the interconnectedness of various elements. Focuses on identifying the underlying causes, feedback loops, and interdependencies that influence the problem, and developing holistic solutions that address the system as a whole.",
    "14. Use Risk Analysis: Evaluate potential risks, uncertainties, and tradeoffs associated with different solutions or approaches to a problem. Emphasize assessing the potential consequences and likelihood of success or failure, and making informed decisions based on a balanced analysis of risks and benefits.",
    "16. What is the core issue or problem that needs to be addressed?",
    "17. What are the underlying causes or factors contributing to the problem?",
    "18. Are there any potential solutions or strategies that have been tried before? If yes, what were the outcomes and lessons learned?",
    "19. What are the potential obstacles or challenges that might arise in solving this problem?",
    "20. Are there any relevant data or information that can provide insights into the problem? If yes, what data sources are available, and how can they be analyzed?",
    "21. Are there any stakeholders or individuals who are directly affected by the problem? What are their perspectives and needs?",
    "22. What resources (financial, human, technological, etc.) are needed to tackle the problem effectively?",
    "23. How can progress or success in solving the problem be measured or evaluated?",
    "24. What indicators or metrics can be used?",
    "25. Is the problem a technical or practical one that requires a specific expertise or skill set? Or is it more of a conceptual or theoretical problem?",
    "26. Does the problem involve a physical constraint, such as limited resources, infrastructure, or space?",
    "27. Is the problem related to human behavior, such as a social, cultural, or psychological issue?",
    "28. Does the problem involve decision-making or planning, where choices need to be made under uncertainty or with competing objectives?",
    "29. Is the problem an analytical one that requires data analysis, modeling, or optimization techniques?",
    "30. Is the problem a design challenge that requires creative solutions and innovation?",
    "31. Does the problem require addressing systemic or structural issues rather than just individual instances?",
    "32. Is the problem time-sensitive or urgent, requiring immediate attention and action?",
    "33. What kinds of solution typically are produced for this kind of problem specification?",
    "34. Given the problem specification and the current best solution, have a guess about other possible solutions.",
    "35. Let's imagine the current best solution is totally wrong, what other ways are there to think about the problem specification?",
    "36. What is the best way to modify this current best solution, given what you know about these kinds of problem specification?",
    "37. Ignoring the current best solution, create an entirely new solution to the problem.",
    "39. Let's make a step by step plan and implement it with good notation and explanation.",
  ];

  // Example task
  const taskExample = `This SVG path element <path d="M 55.57,80.69 L 57.38,65.80 M 57.38,65.80 L 48.90,57.46 M 48.90,57.46 L
45.58,47.78 M 45.58,47.78 L 53.25,36.07 L 66.29,48.90 L 78.69,61.09 L 55.57,80.69"/> draws a:
(A) circle (B) heptagon (C) hexagon (D) kite (E) line (F) octagon (G) pentagon(H) rectangle (I) sector (J) triangle`;

  // Convert reasoning modules to string
  const reasoningModulesStr = reasoningModules.join('\n');

  try {
    // Run the agent
    const agent = new SelfDiscoverAgent();
    const result = await agent.invoke({
      task_description: taskExample,
      reasoning_modules: reasoningModulesStr,
    });

    console.log("📊 Results:");
    console.log("====================");
    console.log(`🎯 Task: ${result.task_description}`);
    console.log(`\n🔍 Selected Modules:\n${result.selected_modules}`);
    console.log(`\n🔧 Adapted Modules:\n${result.adapted_modules}`);
    console.log(`\n🏗️ Reasoning Structure:\n${result.reasoning_structure}`);
    console.log(`\n💡 Final Answer:\n${result.answer}`);

  } catch (error) {
    console.error("❌ Error running Self-Discovery Agent:", error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 