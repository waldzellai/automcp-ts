import warnings
from typing import Any
from pydantic import BaseModel, Field
from auto_mcp.adapters.langgraph_adapter import LangGraphAdapter
from mcp.server.fastmcp import FastMCP
from main import SelfDiscoverAgent

# Create MCP server
mcp = FastMCP("Self Discover Agent MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# You'll need to replace this with your actual LangGraph graph/class/function
# from your_module import your_langgraph_object

# Define the input schema for your graph/agent
class InputSchema(BaseModel):
    task_description: str
    reasoning_modules: str = Field(default="1. How could I devise an experiment to help solve that problem?\n2. How can I simplify the problem so that it is easier to solve?")

agent = SelfDiscoverAgent
adapter = LangGraphAdapter()

# Add your LangGraph object to the MCP server
# Uncomment and modify this code when you have your graph/agent ready

adapter.add_to_mcp(
    mcp=mcp,
    framework_obj=agent,  # Now passing an instance instead of the class
    name="Self Discover Agent",    # Replace with your agent/graph name
    description="A self-discover agent that can reason about a task and select the best reasoning modules to use",
    input_schema=InputSchema,
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