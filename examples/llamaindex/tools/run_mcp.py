import warnings
from typing import Any
from automcp.adapters.llamaindex import create_llamaindex_tool_adapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP
from main import get_weather_tool, get_cat_fact_tool, get_joke_tool
# Create MCP server
mcp = FastMCP("Llama Index tools as MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# Define the input schema for your llamaindex_tool
class WeatherInputSchema(BaseModel):
    location: str

class CatFactInputSchema(BaseModel):
    pass

class JokeInputSchema(BaseModel):
    pass

# Create an adapter for llamaindex_tool
weather_tool = create_llamaindex_tool_adapter(
    tool_instance=get_weather_tool(),
    name="get_weather",
    description="Get the weather for a given location",
    input_schema=WeatherInputSchema,
    is_async_tool=True,
)

cat_fact_tool = create_llamaindex_tool_adapter(
    tool_instance=get_cat_fact_tool(),
    name="get_cat_fact",
    description="Get a random cat fact",
    input_schema=CatFactInputSchema,
    is_async_tool=False,
)

joke_tool = create_llamaindex_tool_adapter(
    tool_instance=get_joke_tool(),
    name="get_joke",
    description="Get a random joke",
    input_schema=JokeInputSchema,
    is_async_tool=True,
)

mcp.add_tool(
    weather_tool,
    name="get_weather",
    description="Get the weather for a given location",
)

mcp.add_tool(
    cat_fact_tool,
    name="get_cat_fact",
    description="Get a random cat fact",
)

mcp.add_tool(
    joke_tool,
    name="get_joke",
    description="Get a random joke",
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