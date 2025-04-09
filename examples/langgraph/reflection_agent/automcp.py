import warnings
from typing import Any
from auto_mcp.adapters.langgraph_adapter import create_langgraph_adapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# You'll need to replace this with your actual LangGraph graph/class/function
from main import ReflectionAgent

# Define the input schema for your graph/agent
class InputSchema(BaseModel):
    query: str

name = "reflection_agent"
description = "A reflection agent that takes an essay and returns a reflection on it"

# Create an adapter for LangGraph
mcp_langgraph_agent = create_langgraph_adapter(
    agent_instance=ReflectionAgent().graph,
    name=name,
    description=description,
    input_schema=InputSchema,
)
mcp.add_tool(
    mcp_langgraph_agent,
    name=name,
    description=description,
)

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