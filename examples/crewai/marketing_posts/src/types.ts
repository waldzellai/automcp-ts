import { z } from 'zod';

// Base interfaces for the multi-agent system
export interface AgentConfig {
  role: string;
  goal: string;
  backstory: string;
  verbose?: boolean;
  memory?: boolean;
  tools?: Tool[];
}

export interface TaskConfig {
  description: string;
  expected_output: string;
  agent?: string;
  context?: string[];
  output_file?: string;
  output_json?: any;
}

export interface Tool {
  name: string;
  description: string;
  execute: (input: any) => Promise<any>;
}

// Pydantic-like models for structured outputs
export const MarketStrategySchema = z.object({
  name: z.string().describe("Name of the market strategy"),
  tactics: z.array(z.string()).describe("List of tactics to be used in the market strategy"),
  channels: z.array(z.string()).describe("List of channels to be used in the market strategy"),
  KPIs: z.array(z.string()).describe("List of KPIs to be used in the market strategy")
});

export const CampaignIdeaSchema = z.object({
  name: z.string().describe("Name of the campaign idea"),
  description: z.string().describe("Description of the campaign idea"),
  audience: z.string().describe("Audience of the campaign idea"),
  channel: z.string().describe("Channel of the campaign idea")
});

export const CopySchema = z.object({
  title: z.string().describe("Title of the copy"),
  body: z.string().describe("Body of the copy")
});

export type MarketStrategy = z.infer<typeof MarketStrategySchema>;
export type CampaignIdea = z.infer<typeof CampaignIdeaSchema>;
export type Copy = z.infer<typeof CopySchema>;

// Process types
export enum ProcessType {
  SEQUENTIAL = "sequential",
  HIERARCHICAL = "hierarchical"
}

// Agent result interface
export interface AgentResult {
  task_id: string;
  agent_role: string;
  output: any;
  raw_output: string;
  execution_time: number;
}

// Crew result interface
export interface CrewResult {
  tasks_output: AgentResult[];
  raw: string;
  pydantic: any;
  json_dict: any;
  usage_metrics?: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    successful_requests: number;
  };
} 