import warnings
from typing import Any
from automcp.adapters.langgraph import create_langgraph_adapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# You'll need to replace these imports with your actual langgraph objects
from main import ReflectionAgent


# Define the input schema for your langgraph
class InputSchema(BaseModel):
    # Replace these with your actual input parameters
    query: str
    # Add more parameters as needed


name = "Reflection_Agent"
description = "A reflection agent that reflects on the user's query"

# Create an adapter for langgraph
mcp_langgraph_agent = create_langgraph_adapter(
    agent_instance=ReflectionAgent().graph,  # Replace with your actual LangGraph agent instance
    name=name,
    description=description,
    input_schema=InputSchema,
)


mcp.add_tool(mcp_langgraph_agent, name=name, description=description)


# Server entrypoints
def serve_sse():
    mcp.run(transport="sse")


def serve_stdio():
    # Redirect stderr to suppress warnings that bypass the filters
    import os
    import sys

    class NullWriter:
        def write(self, *args, **kwargs):
            pass

        def flush(self, *args, **kwargs):
            pass

    # Save the original stderr
    original_stderr = sys.stderr

    # Replace stderr with our null writer to prevent warnings from corrupting STDIO
    sys.stderr = NullWriter()

    # Set environment variable to ignore Python warnings
    os.environ["PYTHONWARNINGS"] = "ignore"

    try:
        mcp.run(transport="stdio")
    finally:
        # Restore stderr for normal operation
        sys.stderr = original_stderr


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "sse":
        serve_sse()
    else:
        serve_stdio()
