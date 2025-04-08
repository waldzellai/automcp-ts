import warnings
from typing import Any
from auto_mcp.adapters.langchain_tool_adapter import LangchainToolAdapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# You'll need to replace this with your actual LangGraph graph/class/function
from main import google_serper_tool, python_repl_tool, arxiv_tool

# Define the input schema for your graph/agent
class SearchGoogleInput(BaseModel):
    query: str

class RunPythonCodeInput(BaseModel):
    command: str

class SearchArxivInput(BaseModel):
    query: str

# Create an adapter for LangGraph
adapter = LangchainToolAdapter()

adapter.add_to_mcp(
    mcp=mcp,
    tool_instance=google_serper_tool, 
    run_func="results",    
    name="search_google_tool",    
    description="Search Google for a query",
    input_schema=SearchGoogleInput,
)

adapter.add_to_mcp(
    mcp=mcp,
    tool_instance=python_repl_tool, 
    run_func="run",    
    name="run_python_code_tool",    
    description="Run Python code",
    input_schema=RunPythonCodeInput,
)

adapter.add_to_mcp(
    mcp=mcp,
    tool_instance=arxiv_tool, 
    name="search_arxiv_tool",    
    description="Search Arxiv for a query",
    input_schema=SearchArxivInput,
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