# Marketing Posts Multi-Agent System

A TypeScript implementation of a multi-agent marketing system inspired by CrewAI, designed to generate comprehensive marketing strategies, campaign ideas, and copy through collaborative AI agents.

## 🚀 Features

- **Multi-Agent Collaboration**: Multiple specialized AI agents working together
- **Sequential Task Execution**: Organized workflow with context sharing between tasks
- **Structured Output**: JSON schema validation for consistent results
- **YAML Configuration**: Easily configurable agents and tasks
- **MCP Integration**: Full Model Context Protocol server implementation
- **Training Support**: Iterative training capability for performance improvement

## 🤖 Agent Roles

1. **Lead Market Analyst**: Conducts market research and competitive analysis
2. **Chief Marketing Strategist**: Synthesizes insights into marketing strategies
3. **Creative Content Creator**: Develops campaign ideas and marketing copy

## 📋 Tasks

1. **Research Task**: Thorough customer and competitor research
2. **Project Understanding**: Analysis of project requirements and target audience
3. **Marketing Strategy**: Comprehensive strategy with tactics, channels, and KPIs
4. **Campaign Ideas**: Creative campaign concepts with audience targeting
5. **Copy Creation**: Marketing copy based on strategy and campaign ideas

## 🛠 Installation

```bash
npm install
```

## 📝 Configuration

Ensure you have the following environment variables set in your `.env` file:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

## 🏃‍♂️ Usage

### Run Marketing Campaign

```bash
npm run dev
```

### Train the Crew

```bash
npm run dev train 5
```

### Build and Run

```bash
npm run build
npm start
```

## 🔌 MCP Server

Run as an MCP server for integration with other tools:

```bash
# STDIO transport
npm run serve:stdio

# SSE transport  
npm run serve:sse
```

### MCP Tools

- `run_marketing_campaign`: Execute complete marketing workflow
- `train_marketing_crew`: Train the crew with multiple iterations

### MCP Resources

- `marketing://crew-status`: Current crew configuration and status
- `marketing://example-inputs`: Example inputs for campaigns

## 📊 Example Input

```typescript
const inputs = {
  customer_domain: "crewai.com",
  project_description: `
    CrewAI, a leading provider of multi-agent systems, aims to revolutionize 
    marketing automation for its enterprise clients. This project involves 
    developing an innovative marketing strategy to showcase CrewAI's advanced 
    AI-driven solutions, emphasizing ease of use, scalability, and integration 
    capabilities.
  `
};
```

## 🏗 Architecture

### Core Components

- **Agent**: Individual AI agents with specific roles and capabilities
- **Task**: Structured work units with expected outputs
- **Crew**: Orchestrator that manages agent collaboration
- **ConfigLoader**: YAML configuration file processor

### Design Patterns

- **Sequential Processing**: Tasks executed in order with context sharing
- **Structured Output**: Zod schema validation for consistent results
- **Tool Integration**: Pluggable tool system for external services
- **Error Handling**: Comprehensive error management and logging

## 🔧 Customization

### Adding New Agents

1. Update `config/agents.yml` with new agent configuration
2. Initialize agent in `MarketingPostsCrew` class
3. Assign tasks to the new agent

### Adding New Tasks

1. Update `config/tasks.yml` with task definition
2. Create task instance in `MarketingPostsCrew`
3. Set task dependencies using `setContext()`

### Custom Tools

Implement the `Tool` interface:

```typescript
class CustomTool implements Tool {
  name = "custom_tool";
  description = "Description of the tool";
  
  async execute(input: any): Promise<string> {
    // Tool implementation
    return "Tool result";
  }
}
```

## 📄 Output Examples

### Marketing Strategy
```json
{
  "name": "AI-Driven Enterprise Marketing Strategy",
  "tactics": ["Content Marketing", "Thought Leadership", "Demo Programs"],
  "channels": ["LinkedIn", "Industry Publications", "Webinars"],
  "KPIs": ["Lead Generation", "Brand Awareness", "Customer Acquisition Cost"]
}
```

### Campaign Ideas
```json
{
  "name": "AI Revolution Campaign",
  "description": "Showcase transformative potential of AI automation",
  "audience": "Tech-savvy decision-makers in medium to large enterprises",
  "channel": "Multi-channel digital campaign"
}
```

## 🧪 Testing

The system includes comprehensive testing capabilities:

- **Training Mode**: Iterative improvement with performance tracking
- **Mock Tools**: Simulated external services for testing
- **Verbose Logging**: Detailed execution tracking
- **Error Handling**: Graceful failure recovery

## 🔍 Monitoring

- **Execution Metrics**: Token usage, success rates, timing
- **Task Tracking**: Individual task performance and outputs
- **Agent Performance**: Role-specific performance analytics
- **Usage Statistics**: Comprehensive usage reporting

## 🚀 Production Deployment

### Environment Setup
- Set production environment variables
- Configure appropriate logging levels
- Set up monitoring and alerting

### Scaling Considerations
- Implement request queuing for high load
- Add caching for frequently used responses
- Consider rate limiting for API calls

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by [CrewAI](https://github.com/joaomdmoura/crewAI) Python framework
- Built with [Model Context Protocol](https://modelcontextprotocol.io/)
- Powered by [OpenAI](https://openai.com/) language models 