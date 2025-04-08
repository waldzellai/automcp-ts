import warnings
from typing import Any
from auto_mcp.adapters.function_adapter import FunctionAdapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# You'll need to replace this with your actual LangGraph graph/class/function
from main import run_mcp_agent

class RunMCPAgentInput(BaseModel):
    query: str

# Create an adapter for LangGraph
adapter = FunctionAdapter()

adapter.add_to_mcp(
    mcp=mcp,
    framework_obj=run_mcp_agent, # Replace with your actual function
    name="run_mcp_agent",    # Replace with your function name
    description="Run the MCP agent which has fetch and filesystem tools",
    input_schema=RunMCPAgentInput,
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