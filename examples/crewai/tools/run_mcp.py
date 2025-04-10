import warnings
from typing import Any
from automcp.adapters.crewai import create_crewai_tool_adapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# You'll need to replace these imports with your actual crewai_tool objects
from main import serper_tool, exa_tool

# Define the input schema for your crewai_tool
class SerperExaToolInput(BaseModel):
    search_query: str

serper_tool_name = "serper_tool"
serper_tool_description = "A tool that uses Serper to search the web"

# Create an adapter for crewai_tool
mcp_crewai_tool = create_crewai_tool_adapter(
    tool_instance=serper_tool,
    name=serper_tool_name,
    description=serper_tool_description,
    input_schema=SerperExaToolInput,
)


mcp.add_tool(
    mcp_crewai_tool,
    name=serper_tool_name,
    description=serper_tool_description
)

exa_tool_name = "exa_tool"
exa_tool_description = "A tool that uses Exa to search the web"

# Create an adapter for crewai_tool
mcp_crewai_tool = create_crewai_tool_adapter(
    tool_instance=exa_tool,
    name=exa_tool_name,
    description=exa_tool_description,   
    input_schema=SerperExaToolInput,
)

mcp.add_tool(
    mcp_crewai_tool,
    name=exa_tool_name,
    description=exa_tool_description
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