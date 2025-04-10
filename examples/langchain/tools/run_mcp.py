import warnings
from typing import Any
from automcp.adapters.langchain import create_langchain_tool_adapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# You'll need to replace these imports with your actual langchain_tool objects
from main import google_serper_tool, python_repl_tool, arxiv_tool   

# Define the input schema for your langchain_tool
class GoogleSerperToolInput(BaseModel):
    query: str

class PythonREPLToolInput(BaseModel):
    command: str

class ArxivToolInput(BaseModel):
    query: str


google_serper_tool_name = "google_serper_tool"
google_serper_tool_description = "A tool that uses Google Serper to search the web"

# Create an adapter for langchain_tool
mcp_langchain_tool = create_langchain_tool_adapter(
    tool_instance=google_serper_tool,
    name=google_serper_tool_name,
    description=google_serper_tool_description,
    input_schema=GoogleSerperToolInput,
)

mcp.add_tool(
    mcp_langchain_tool,
    name=google_serper_tool_name,
    description=google_serper_tool_description
)

python_repl_tool_name = "python_repl_tool"
python_repl_tool_description = "A tool that uses Python REPL to run code"

mcp_langchain_tool = create_langchain_tool_adapter(
    tool_instance=python_repl_tool,
    name=python_repl_tool_name,
    description=python_repl_tool_description,
    input_schema=PythonREPLToolInput,
)

mcp.add_tool(
    mcp_langchain_tool,
    name=python_repl_tool_name,
    description=python_repl_tool_description
)

arxiv_tool_name = "arxiv_tool"
arxiv_tool_description = "A tool that uses Arxiv to search the web"

mcp_langchain_tool = create_langchain_tool_adapter(
    tool_instance=arxiv_tool,
    name=arxiv_tool_name,
    description=arxiv_tool_description,
    input_schema=ArxivToolInput,
)

mcp.add_tool(
    mcp_langchain_tool,
    name=arxiv_tool_name,
    description=arxiv_tool_description
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