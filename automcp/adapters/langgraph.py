from typing import Any, Callable, Type
from pydantic import BaseModel
import inspect
import contextlib
import io
import asyncio
from automcp.adapters.utils import ensure_serializable


def create_langgraph_adapter(
    agent_instance: Any,
    name: str,
    description: str,
    input_schema: Type[BaseModel],
) -> Callable:
    """
    Convert a graph object to an MCP tool, making it async.

    Args:
        agent_instance: The agent object
        name: The name of the MCP tool
        description: The description of the MCP tool
        input_schema: The Pydantic model class defining the input schema

    Returns:
        An awaitable callable function that can be used as an MCP tool
    """
    schema_fields = input_schema.model_fields
    params_str = ", ".join(
        f"{field_name}: {field_info.annotation.__name__ if hasattr(field_info.annotation, '__name__') else 'Any'}"
        for field_name, field_info in schema_fields.items()
    )

    # Create the function body with proper async/await
    body_str = f"""async def run_agent({params_str}):
        # Create the input object
        input_data = input_schema({', '.join(f'{name}={name}' for name in schema_fields)})
        input_dict = input_data.model_dump()
        
        # Call the async run method
        with contextlib.redirect_stdout(io.StringIO()):
            result = await agent_instance.ainvoke(input_dict)
            result = ensure_serializable(result)
        
        return result
    """

    namespace = {
        "input_schema": input_schema,
        "agent_instance": agent_instance,
        "contextlib": contextlib,
        "io": io,
        "asyncio": asyncio, 
        "inspect": inspect,
        "ensure_serializable": ensure_serializable
    }

    exec(body_str, namespace)

    # Get the created async function
    run_agent = namespace["run_agent"]

    # Add proper function metadata
    run_agent.__name__ = name
    run_agent.__doc__ = description

    return run_agent
