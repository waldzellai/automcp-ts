# auto-mcp

Automatically convert agent frameworks to MCP servers.

## 🚀 Overview

auto-mcp is a tool that helps you convert existing AI agent frameworks into MCP (Machine Control Protocol) servers with minimal effort. This allows your agents to be accessible via standardized interfaces used by tools like Cursor and Claude Desktop.

Currently supported frameworks:

- CrewAI

## 🔧 Installation

Install from PyPI:

```bash
# Basic installation
pip install auto-mcp

# With framework-specific dependencies
pip install auto-mcp[crewai]
```

Or install from source:

```bash
git clone https://github.com/napthaai/auto-mcp.git
cd auto-mcp
pip install -e .
```

## 🧩 Quick Start

Create a new MCP server for your project

Navigate to your project directory with your agent implementation:

```bash
cd your-project-directory
```

Generate the MCP server files:

```bash
auto_mcp new
```

Edit the generated mcp_server.py file to configure your agent:

```python
# Replace these imports with your actual agent classes
from your_module import YourCrewClass

# Define the input schema
class InputSchema(BaseModel):
    parameter1: str
    parameter2: str

# Uncomment and modify
adapter.add_to_mcp(
    mcp=mcp,
    framework_obj=YourCrewClass,
    name="Your Agent Name",
    description="Description of your agent",
    input_schema=InputSchema,
)
```

Install dependencies and run your MCP server:

```bash
# Install dependencies
uv sync

# Run with STDIO transport (for Cursor)
python -m mcp_server

# Or run with SSE transport
python -m mcp_server sse
```

## 📁 Generated Files

When you run `auto_mcp new`, two important files are generated:

### mcp_server.py

This is the main file that sets up and runs your MCP server. It contains:

- Server initialization code
- STDIO and SSE transport handlers
- A placeholder for your agent implementation
- Utilities to suppress warnings that might corrupt the STDIO protocol

You'll need to edit this file to:

- Import your agent/crew classes
- Define your input schema (the parameters your agent accepts)
- Configure the adapter with your agent

### pyproject.toml

This file is created or updated with:

- Dependencies for your MCP server and the selected framework
- Build configuration necessary for installation
- Direct reference to the local auto_mcp package

**Important**: You may need to add additional dependencies specific to your agent. For example, if your CrewAI agent uses specific tools or models, add them to the dependencies list:

```toml
[project.dependencies]
langchain-openai = ">=0.1.0"
langchain-community = ">=0.0.16"
```

## 🚧 CLI Method Status

The CLI method (`auto_mcp new`) is currently in development. While functional, you may encounter some issues:

- Only CrewAI is fully supported at this time
- Some environment setup might need manual intervention
- Dependency management is being improved

We're actively working on enhancing the CLI experience to make it more robust and user-friendly.

## 🔍 Examples

### Running the examples

The repository includes examples for each supported framework:

```bash
# Clone the repository
git clone https://github.com/napthaai/auto-mcp.git
cd auto-mcp

# Install auto-mcp in development mode
pip install -e .

# Run the CrewAI marketing example
cd examples/crewai/marketing_agents
uv sync
python -m mcp_server
```

### CrewAI example

```python
from pydantic import BaseModel
from auto_mcp.adapters.crewai_adapter import CrewAIAdapter
from mcp.server.fastmcp import FastMCP
from your_crew_module import YourCrew

# Create MCP server
mcp = FastMCP("MCP Server")

# Define input schema
class InputSchema(BaseModel):
    topic: str
    depth: str = "medium"

# Create adapter and add crew
adapter = CrewAIAdapter()
adapter.add_to_mcp(
    mcp=mcp,
    framework_obj=YourCrew,
    name="Research Crew",
    description="A crew that researches a given topic",
    input_schema=InputSchema,
)

# Server entrypoints
def serve_sse():
    mcp.run(transport="sse")

def serve_stdio():
    # Redirect stderr to prevent warnings from corrupting STDIO
    import os
    import sys
    
    class NullWriter:
        def write(self, *args, **kwargs): pass
        def flush(self, *args, **kwargs): pass
    
    original_stderr = sys.stderr
    sys.stderr = NullWriter()
    os.environ["PYTHONWARNINGS"] = "ignore"
    
    try:
        mcp.run(transport="stdio")
    finally:
        sys.stderr = original_stderr

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "sse":
        serve_sse()
    else:
        serve_stdio()
```

## 🔄 Running Your MCP Server

After setting up your files, you can run your server using one of these methods:

```bash
# Using Python module syntax
python -m mcp_server       # STDIO transport
python -m mcp_server sse   # SSE transport

# Or with uv run (if configured in pyproject.toml)
uv run serve_stdio
uv run serve_sse
```

**Note about transport modes:**
- **STDIO**: You don't need to run the server manually - it will be started by the client (Cursor)
- **SSE**: This is a two-step process:
  1. Start the server separately: `python -m mcp_server sse`
  2. Add the mcp.json configuration to connect to the running server

## 🔌 Using with MCP Clients

### Cursor

To integrate with Cursor IDE, create a `.cursor` folder in your project root and add an `mcp.json` file with the following configuration:

```json
{
    "mcpServers": {
        "crew-name-stdio": {
            "type": "stdio",
            "command": "/path/to/your/.venv/bin/python",
            "args": [
                "/path/to/your/mcp_server.py"
            ],
            "env": {
                "OPENAI_API_KEY": "sk-",
                "SERPER_API_KEY": ""
            }
        },
        "crew-name-sse": {
            "type": "sse",
            "url": "http://localhost:8000/sse"
        }
    }
}
```

### Direct GitHub Execution

Push your project to GitHub and use:

```json
{
   "mcpServers": {
       "My Agent": {
           "command": "uvx",
           "args": [
               "--from",
               "git+https://github.com/your-username/your-repo serve_stdio"
           ],
           "env": {
               "OPENAI_API_KEY": "your-key-here"
           }
       }
   }
}
```

## 🔍 Troubleshooting

- If `uv sync` fails with build errors, check your pyproject.toml configuration
- Make sure all dependencies required by your agent are listed in pyproject.toml
- For STDIO transport issues, ensure no print statements or warnings are leaking to stdout
- When using CrewAI, both OPENAI_API_KEY and SERPER_API_KEY (or equivalent research tool) are often required

## 🛠️ Creating New Adapters

Want to add support for a new agent framework? Here's how:

1. Create a new adapter file in auto_mcp/adapters/:

```python
# auto_mcp/adapters/your_framework_adapter.py
from typing import Any, Callable, Type
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP
from auto_mcp.core.adapter_base import BaseMCPAdapter

class YourFrameworkAdapter(BaseMCPAdapter):
    """Adapter for converting YourFramework agents to MCP tools."""
    
    def convert_to_mcp_tool(
        self,
        framework_obj: Any,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
    ) -> Callable:
        """Convert agent to MCP tool."""
        # Your implementation here
        pass
    
    def add_to_mcp(
        self,
        mcp: FastMCP,
        framework_obj: Any,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
    ) -> None:
        """Add agent to MCP server."""
        tool = self.convert_to_mcp_tool(
            framework_obj=framework_obj,
            name=name,
            description=description,
            input_schema=input_schema,
        )
        mcp.add_tool(
            tool,
            name=name,
            description=description,
        )
```

2. Add your adapter directly to the auto_mcp CLI:

```python
# In auto_mcp/cli.py
# Update the CLI choices to include your new framework
new_parser.add_argument(
    "--framework", 
    choices=["crewai", "your_framework"], 
    default="crewai",
    help="Agent framework to use"
)

# In the create_mcp_server_file function, add a new condition:
elif framework == "your_framework":
    content = """
    # Your framework-specific template code here
    """
```

3. Add framework-specific dependencies in pyproject.toml:

```toml
[project.optional-dependencies]
your_framework = [
    "your-framework>=1.0.0",
]
```

4. Create an example in examples/your_framework/

## 📝 Notes

- When working with STDIO transport, be careful with print statements in your agent code as they can corrupt the protocol
- The MCP Inspector can be used for debugging: npx @modelcontextprotocol/inspector
- Environment variables should be set before running the server for sse
- For projects requiring environment variables, create a `.env` file in your project directory
- Remember that for STDIO mode, the client (like Cursor) will start the server for you
- For SSE mode, you need to manually start the server and then configure the client to connect to it