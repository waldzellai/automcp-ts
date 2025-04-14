import warnings
from typing import Any
from automcp.adapters.pydantic import create_pydantic_adapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# You'll need to replace these imports with your actual pydantic objects
from main import weather_agent


# Define the input schema for your pydantic
class InputSchema(BaseModel):
    # Replace these with your actual input parameters
    query: str
    # Add more parameters as needed


name = "Weather_Agent"
description = "A weather agent that can help you get the weather of a city"

# Create an adapter for pydantic
mcp_pydantic_agent = create_pydantic_adapter(
    agent_instance=weather_agent,  # Replace with your actual Pydantic agent instance
    name=name,
    description=description,
    input_schema=InputSchema,
)


mcp.add_tool(mcp_pydantic_agent, name=name, description=description)


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
