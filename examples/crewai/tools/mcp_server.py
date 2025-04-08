import warnings
from typing import Any
from auto_mcp.adapters.crewai_tool_adapter import CrewaiToolAdapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# You'll need to replace this with your actual LangGraph graph/class/function
from main import serper_tool, exa_tool

class SearchGoogleInput(BaseModel):
    search_query: str

class SearchExaInput(BaseModel):
    search_query: str

# Create an adapter for LangGraph
adapter = CrewaiToolAdapter()

adapter.add_to_mcp(
    mcp=mcp,
    tool_instance=serper_tool,
    name="search_google_tool",
    description="Search Google for a query",
    input_schema=SearchGoogleInput,
)

adapter.add_to_mcp(
    mcp=mcp,
    tool_instance=exa_tool,
    name="search_exa_tool",
    description="Search Exa for a query",
    input_schema=SearchExaInput,
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