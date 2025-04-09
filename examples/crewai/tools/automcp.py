import warnings
from typing import Any
from auto_mcp.adapters.crewai_tool_adapter import create_crewai_tool_adapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# You'll need to replace these imports with your actual crew class
from main import serper_tool, exa_tool

class SearchGoogleInput(BaseModel):
    search_query: str

class SearchExaInput(BaseModel):
    search_query: str

name_search_google_tool = "search_google_tool"
description_search_google_tool = "Search Google for a query"

# Create an adapter for LangGraph
mcp_serper_tool = create_crewai_tool_adapter(
    tool_instance=serper_tool,
    name=name_search_google_tool,
    description=description_search_google_tool,
    input_schema=SearchGoogleInput,
)

name_search_exa_tool = "search_exa_tool"
description_search_exa_tool = "Search Exa for a query"

mcp_exa_tool = create_crewai_tool_adapter(
    tool_instance=exa_tool,
    name=name_search_exa_tool,
    description=description_search_exa_tool,
    input_schema=SearchExaInput,
)

mcp.add_tool(
    mcp_serper_tool,
    name=name_search_google_tool,
    description=description_search_google_tool,
)

mcp.add_tool(
    mcp_exa_tool,
    name=name_search_exa_tool,
    description=description_search_exa_tool,
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