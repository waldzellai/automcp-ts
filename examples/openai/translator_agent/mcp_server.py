import warnings
from typing import Any
from auto_mcp.adapters.openai_adapter import OpenAIAdapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP
from main import TranslatorAgent

# Create MCP server
mcp = FastMCP("OpenAI Translator Agent MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

class InputSchema(BaseModel):
    message: str

# Create an adapter for OpenAI
adapter = OpenAIAdapter()
agent = TranslatorAgent

adapter.add_to_mcp(
    mcp=mcp,
    framework_obj=agent,
    name="Translator Agent",
    description="Translate the user's message to Spanish, French, and Italian",
    input_schema=InputSchema,
)

# Server entrypoints
def serve_sse():
    mcp.run(transport="sse")

def serve_stdio():
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
