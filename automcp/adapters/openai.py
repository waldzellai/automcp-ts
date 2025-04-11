import contextlib
import io
import asyncio
import inspect
from typing import Any, Callable, Type, Optional
from pydantic import BaseModel
from agents import Runner

def create_openai_adapter(
    agent_instance: Any,
    name: str,
    description: str,
    input_schema: Type[BaseModel],
) -> Callable:
    """
    Convert OpenAI agents to an MCP tool
    Args:
        agent_instance: The main agent instance that should always be executed.
        name: The name of the MCP tool.
        description: The description of the MCP tool.
        input_schema: The Pydantic model class defining the input schema.
    """
    schema_fields = input_schema.model_fields

    params_str = ", ".join(
        f"{field_name}: {field_info.annotation.__name__ if hasattr(field_info.annotation, '__name__') else 'Any'}"
        for field_name, field_info in schema_fields.items()
    )

    body_str = f"""async def run_agent({params_str}):
        input_data = input_schema({', '.join(f'{name}={name}' for name in schema_fields)})
        input_dict = input_data.model_dump()

        with contextlib.redirect_stdout(io.StringIO()):
            result = await Runner.run(agent_instance, *list(input_dict.values()))

        return result.final_output
    """
    
    namespace = {
        "input_schema": input_schema,
        "agent_instance": agent_instance,
        "contextlib": contextlib,
        "io": io,
        "asyncio": asyncio,
        "inspect": inspect,
        "Runner": Runner,
    }

    exec(body_str, namespace)
    run_agent = namespace["run_agent"]
    run_agent.__name__ = name
    run_agent.__doc__ = description

    return run_agent