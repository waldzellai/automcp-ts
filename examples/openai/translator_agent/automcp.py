import warnings
from typing import Any
from automcp.adapters.openai_adapter import create_openai_orchestrator_adapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP
from main import TranslatorAgent

# Create MCP server
mcp = FastMCP("OpenAI Translator Agent MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# Define the input schema for your OpenAI agent
class InputSchema(BaseModel):
    message: str

translator_agent = TranslatorAgent()

adapter = create_openai_orchestrator_adapter(
    run_after_func=translator_agent.run_after,
    main_agent_instance=translator_agent.get_synthesizer_agent(),
    name="Translator Agent",
    description="A translator agent that translates text from English to Spanish",
    input_schema=InputSchema,
)

mcp.add_tool(
    adapter,
    name="Translator Agent",
    description="A translator agent that translates text from English to Spanish",
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
