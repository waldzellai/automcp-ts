#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';
import { MarketingPostsCrew } from './marketing-posts-crew.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = resolve(__dirname, '../../../.env');
config({ path: envPath });

class MarketingPostsServer {
  private server: Server;
  private marketingCrew: MarketingPostsCrew;

  constructor() {
    this.server = new Server(
      {
        name: 'marketing-posts-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.marketingCrew = new MarketingPostsCrew();
    this.setupToolHandlers();
    this.setupResourceHandlers();
    
    // Error handling
    this.server.onerror = (error: unknown) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'run_marketing_campaign',
          description: 'Execute the complete marketing posts crew workflow to generate marketing strategy, campaign ideas, and copy',
          inputSchema: {
            type: 'object',
            properties: {
              customer_domain: {
                type: 'string',
                description: 'The customer domain or company website',
              },
              project_description: {
                type: 'string',
                description: 'Detailed description of the marketing project',
              },
            },
            required: ['customer_domain', 'project_description'],
          },
        },
        {
          name: 'train_marketing_crew',
          description: 'Train the marketing crew with multiple iterations to improve performance',
          inputSchema: {
            type: 'object',
            properties: {
              iterations: {
                type: 'number',
                description: 'Number of training iterations',
                default: 3,
              },
              customer_domain: {
                type: 'string',
                description: 'The customer domain for training',
              },
              project_description: {
                type: 'string',
                description: 'Training project description',
              },
            },
            required: ['customer_domain', 'project_description'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'run_marketing_campaign': {
            const { customer_domain, project_description } = args as {
              customer_domain: string;
              project_description: string;
            };

            const crew = this.marketingCrew.crew();
            const result = await crew.kickoff({
              customer_domain,
              project_description,
            });

            return {
              content: [
                {
                  type: 'text',
                  text: `Marketing Campaign Results:

📊 **Execution Summary:**
- Total tasks completed: ${result.tasks_output.length}
- Process: Sequential
- Success rate: ${result.usage_metrics?.successful_requests || 0}/${result.tasks_output.length}

📈 **Usage Metrics:**
- Total tokens: ${result.usage_metrics?.total_tokens || 0}
- Successful requests: ${result.usage_metrics?.successful_requests || 0}

🎯 **Final Output:**
${JSON.stringify(result.pydantic, null, 2)}

📝 **Detailed Results:**
${result.tasks_output.map((task, index) => 
  `\n**Task ${index + 1} (${task.agent_role}):**\n${task.raw_output}\n`
).join('\n')}`,
                },
              ],
            };
          }

          case 'train_marketing_crew': {
            const { iterations = 3, customer_domain, project_description } = args as {
              iterations?: number;
              customer_domain: string;
              project_description: string;
            };

            // Run training
            await this.marketingCrew.train(iterations, {
              customer_domain,
              project_description,
            });

            return {
              content: [
                {
                  type: 'text',
                  text: `Training completed successfully!

🎯 **Training Summary:**
- Iterations: ${iterations}
- Customer Domain: ${customer_domain}
- Status: Completed

The marketing crew has been trained with ${iterations} iterations to improve performance on similar marketing projects.`,
                },
              ],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new McpError(ErrorCode.InternalError, errorMessage);
      }
    });
  }

  private setupResourceHandlers(): void {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'marketing://crew-status',
          name: 'Marketing Crew Status',
          description: 'Current status and configuration of the marketing crew',
          mimeType: 'application/json',
        },
        {
          uri: 'marketing://example-inputs',
          name: 'Example Campaign Inputs',
          description: 'Example inputs for running marketing campaigns',
          mimeType: 'application/json',
        },
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case 'marketing://crew-status': {
          const crew = this.marketingCrew.crew();
          const status = {
            agents: crew.agentsList.map(agent => ({
              role: agent.role,
              goal: agent.goal,
              backstory: agent.backstory,
            })),
            tasks: crew.tasksList.map(task => ({
              description: task.description,
              expected_output: task.expectedOutput,
              output_file: task.outputFile,
            })),
            configuration: {
              process: 'sequential',
              verbose: true,
              total_agents: crew.agentsList.length,
              total_tasks: crew.tasksList.length,
            },
          };

          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(status, null, 2),
              },
            ],
          };
        }

        case 'marketing://example-inputs': {
          const exampleInputs = {
            examples: [
              {
                customer_domain: "crewai.com",
                project_description: "CrewAI, a leading provider of multi-agent systems, aims to revolutionize marketing automation for its enterprise clients."
              },
              {
                customer_domain: "techstartup.io",
                project_description: "TechStartup.io is developing an innovative SaaS platform for project management and wants to create a comprehensive marketing strategy."
              },
              {
                customer_domain: "aicompany.ai",
                project_description: "AI Company is launching a new machine learning platform and needs a marketing campaign targeting data scientists and ML engineers."
              }
            ],
            template: {
              customer_domain: "your-domain.com",
              project_description: "Detailed description of your marketing project, target audience, goals, and unique value proposition."
            }
          };

          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(exampleInputs, null, 2),
              },
            ],
          };
        }

        default:
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Unknown resource: ${uri}`
          );
      }
    });
  }

  async run(transport: 'stdio' | 'sse', options?: any): Promise<void> {
    let serverTransport;
    
    if (transport === 'stdio') {
      serverTransport = new StdioServerTransport();
    } else if (transport === 'sse') {
      serverTransport = new SSEServerTransport('/message', options);
    } else {
      throw new Error('Invalid transport type');
    }

    await this.server.connect(serverTransport);
    console.error('Marketing Posts MCP server running on', transport);
  }
}

// CLI interface
async function main(): Promise<void> {
  const transport = (process.argv[2] as 'stdio' | 'sse') || 'stdio';
  const server = new MarketingPostsServer();
  await server.run(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Server failed to start:', error);
    process.exit(1);
  });
} 