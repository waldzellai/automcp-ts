# auto-mcp

Automatically convert functions, tools and agents to MCP servers.

## 🧩 Installing auto-mcp

You can install the SDK using PyPI or from source.

### Install within an existing project

If you want to install auto-mcp as part of an existing project (e.g. to automatically convert existing agents or tools to MCP servers), it is good practice to do so within a dedicated virtual environment. 

#### 1. (Optional) Create a new virtual environment

If you don't already have a virtual environment, create a new one using `uv`:

```bash
uv init
source .venv/bin/activate
```

#### 2. Add auto-mcp to your dependencies

Then add auto-mcp. In `uv` this looks like:

```bash
uv add auto-mcp
```

If not using `uv` or `poetry`, you can also use pip:

```bash
pip install auto-mcp
```

#### 3. Initialize automcp

Use the CLI to run the following command:

```bash
automcp init
```

This will create an `automcp.py` file at the root of your project.

#### 4. Modify the `automcp.py` file

Modify the `automcp.py` file to:

1. Import the agents or tools you would like to convert from your existing project
2. Import the adapters from `automcp` that correspond to the agent framework that you are using
3. Define an input schema for the agent or tool

A simple example `automcp.py` for a CrewAI agent might look like:

```python
from marketing_posts.crew import MarketingPostsCrew
from automcp import crewai_adapter

class InputSchema(BaseModel):
    customer_domain: str
    project_description: str

mcp = FastMCP("my MCP Server")
name = "Marketing Crew"
description = "A crew that creates marketing posts"
input_schema = InputSchema

tool = crewai_adapter(
    crewai_class=MarketingPostsCrew,
    name=name,
    description=description,
    input_schema=input_schema,
)
mcp.add_tool(
    tool,
    name=name,
    description=description,
)

if __name__ == "__main__":
    serve_stdio(mcp)  # Launch the MCP server 
```

#### 5. Configure your `.env` file

Add any required environmental variables:

```
OPENAI_API_KEY=<your_openai_api_key>
SERPER_API_KEY=<your_serper_api_key>
```

#### 6. Start the Server(s)

Using STDIO:

```bash
uv run serve_stdio
```

Using SSE:

```bash
uv run serve_sse
```

#### 7. Testing and Integration

**Cursor**

Here is an example configuration of `mcp.json` that runs the MCP server using STDIO:

```
{
   "mcpServers": {
       "Marketing Crew": {
           "command": "uvx",
           "args": [
               "--from",
               "git+https://github.com/K-Mistele/example-mcp serve_stdio"
           ],
           "env": {
               "OPENAI_API_KEY": "...",
               "SERPER_API_KEY": "..."
           }
       }
   }
}

```

With SSE:

```
{
   "mcpServers": {
       "Marketing Crew": {
           "url": "http://localhost:8000/sse"
       }
   }
}
```

#### 8. Publish

Coming soon!


### Install from source

If you are a developer contributing to AutoMCP, you will want to install from source using:

```bash
git clone https://github.com/NapthaAI/auto-mcp.git
cd auto-mcp
uv venv
source .venv/bin/activate
uv pip install .
```