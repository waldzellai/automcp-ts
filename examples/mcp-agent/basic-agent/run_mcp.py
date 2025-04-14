import warnings
from typing import Any
from automcp.adapters.mcp_agent import create_mcp_agent_adapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP
from mcp_agent.workflows.llm.augmented_llm_openai import OpenAIAugmentedLLM


# Create MCP server
mcp = FastMCP("MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# You'll need to replace these imports with your actual mcp_agent objects
from main import app, finder_agent, app_initialize


# Define the input schema for your mcp_agent
class InputSchema(BaseModel):
    query: str


name = "multipurpose_agent"
description = "A multipurpose agent that can help you with reading filesystem and fetch information from the web"

# Create an adapter for mcp_agent
mcp_agent = create_mcp_agent_adapter(
    agent_instance=finder_agent,
    llm=OpenAIAugmentedLLM,
    app=app,
    app_initialize_fn=app_initialize,
    name=name,
    description=description,
    input_schema=InputSchema,
)


mcp.add_tool(mcp_agent, name=name, description=description)


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
