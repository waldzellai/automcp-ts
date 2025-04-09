import warnings
from typing import Any
from auto_mcp.adapters.langchain_tool_adapter import create_langchain_tool_adapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# You'll need to replace these imports with your actual crew class
from main import google_serper_tool, python_repl_tool, arxiv_tool

class SearchGoogleInput(BaseModel):
    query: str

class RunPythonCodeInput(BaseModel):
    command: str

class SearchArxivInput(BaseModel):
    query: str

name_search_google_tool = "search_google_tool"
description_search_google_tool = "Search Google for a query"

mcp_google_serper_tool = create_langchain_tool_adapter(
    tool_instance=google_serper_tool,
    name=name_search_google_tool,
    description=description_search_google_tool,
    input_schema=SearchGoogleInput,
    run_func="results",
)

name_run_python_code_tool = "run_python_code_tool"
description_run_python_code_tool = "Run Python code"

mcp_python_repl_tool = create_langchain_tool_adapter(
    tool_instance=python_repl_tool,
    name=name_run_python_code_tool,
    description=description_run_python_code_tool,
    input_schema=RunPythonCodeInput,
)

name_search_arxiv_tool = "search_arxiv_tool"
description_search_arxiv_tool = "Search Arxiv for a query"

mcp_arxiv_tool = create_langchain_tool_adapter(
    tool_instance=arxiv_tool,
    name=name_search_arxiv_tool,
    description=description_search_arxiv_tool,
    input_schema=SearchArxivInput,
)

mcp.add_tool(
    mcp_google_serper_tool,
    name=name_search_google_tool,
    description=description_search_google_tool,
)
mcp.add_tool(
    mcp_python_repl_tool,
    name=name_run_python_code_tool,
    description=description_run_python_code_tool,
)
mcp.add_tool(
    mcp_arxiv_tool,
    name=name_search_arxiv_tool,
    description=description_search_arxiv_tool,
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