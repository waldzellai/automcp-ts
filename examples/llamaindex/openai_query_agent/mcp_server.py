import warnings
from typing import Any
from auto_mcp.adapters.llamaindex_adapter import LlamaIndexAdapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP
from main import QueryAgent

# Create MCP server
mcp = FastMCP("LLAMA INDEX QUERY AGENT")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# Define the input schema for the QueryAgent
class InputSchema(BaseModel):
    query: str = "Tell me about the arts and culture of the city with the highest population."

# Create an adapter for LlamaIndex
adapter = LlamaIndexAdapter()

# Add the QueryAgent to the MCP server
adapter.add_to_mcp(
    mcp=mcp,
    framework_obj=QueryAgent,  # The QueryAgent class from main.py
    name="City Information Agent",  # Name of the agent
    description="An agent that can answer questions about cities using both SQL and vector search capabilities",
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