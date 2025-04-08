import asyncio
import os
from dotenv import load_dotenv
from mcp.types import TextContent
from mcp_agent.config import (
    Settings,
    LoggerSettings,
    MCPSettings,
    MCPServerSettings,
    OpenAISettings,
    AnthropicSettings,
)
from mcp_agent.app import MCPApp
from mcp_agent.agents.agent import Agent
from mcp_agent.workflows.llm.augmented_llm_openai import OpenAIAugmentedLLM

load_dotenv()

settings = Settings(
    execution_engine="asyncio",
    logger=LoggerSettings(type="file", level="debug"),
    mcp=MCPSettings(
        servers={
            "fetch": MCPServerSettings(
                command="uvx",
                args=["mcp-server-fetch"],
            ),
            "filesystem": MCPServerSettings(
                command="npx",
                args=["-y", "@modelcontextprotocol/server-filesystem"],
            ),
        }
    ),
    openai=OpenAISettings(
        api_key=os.getenv("OPENAI_API_KEY"),
        default_model="gpt-4o-mini",
    ),
)


app = MCPApp(name="mcp_basic_agent", settings=settings)

async def run_mcp_agent(
    query: str,
):
    """
    Handle tool execution requests.
    """
    if query is None:
        raise ValueError("Missing arguments")

    try:
        await app.initialize()
        app.context.config.mcp.servers["filesystem"].args.extend([os.getcwd()])

        finder_agent = Agent(
            name="finder",
            instruction="""You are an agent with access to the filesystem, 
            as well as the ability to fetch URLs. Your job is to identify 
            the closest match to a user's request, make the appropriate tool calls, 
            and return the URI and CONTENTS of the closest match.""",
            server_names=["fetch", "filesystem"],
        )
        llm = await finder_agent.attach_llm(OpenAIAugmentedLLM)
        response = await llm.generate_str(query)
        return TextContent(type="text", text=response)

    except Exception as e:
        raise ValueError(f"Error: {e}")

if __name__ == "__main__":
    print(asyncio.run(run_mcp_agent("summarize the contents of the file test-file.txt")))

