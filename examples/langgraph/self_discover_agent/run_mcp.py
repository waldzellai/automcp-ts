import warnings
from typing import Any
from automcp.adapters.langgraph import create_langgraph_adapter
from pydantic import BaseModel, Field
from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# You'll need to replace these imports with your actual langgraph objects
from main import SelfDiscoverAgent


# Define the input schema for your langgraph
class InputSchema(BaseModel):
    task_description: str
    reasoning_modules: str = Field(
        default="1. How could I devise an experiment to help solve that problem?\n2. How can I simplify the problem so that it is easier to solve?"
    )


name = "Self_Discover_Agent"
description = "A self-discover agent that can help you discover new things"

# Create an adapter for langgraph
mcp_langgraph_agent = create_langgraph_adapter(
    agent_instance=SelfDiscoverAgent().get_agent(),
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
