import warnings
from typing import Any
from automcp.adapters.crewai_agent_adapter import create_crewai_agent_adapter
from main import data_analyst, test_task
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# You'll need to replace these imports with your actual crewai agent and task objects
# from your_module import YourAgentInstance, YourTaskInstance

class InputSchema(BaseModel):
    topic: str

name = "Data Analyst"
description = "An agent that can answer questions about data"

adapter = create_crewai_agent_adapter(
    agent_instance=data_analyst,
    task_instance=test_task,
    name=name,
    description=description,
    input_schema=InputSchema,
)

mcp.add_tool(
    adapter,
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