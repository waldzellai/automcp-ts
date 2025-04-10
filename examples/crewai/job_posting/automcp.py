import warnings
from typing import Any
from automcp.adapters.crewai_orchestrator_adapter import create_crewai_orchestrator_adapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# You'll need to replace these imports with your actual crew class
from crew import JobPostingCrew

# Define the input schema for your crew
class InputSchema(BaseModel):
    company_domain: str
    hiring_needs: str
    company_description: str
    specific_benefits: str

name = "job_posting_crew"
description = "A crew to generate a job posting"

# Uncomment and modify this code when you have your crew orchestrator instance ready
adapter = create_crewai_orchestrator_adapter(
    framework_obj=JobPostingCrew().crew,
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