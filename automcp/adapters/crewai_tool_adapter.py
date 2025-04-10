# langgraph_adapter.py (Modified)

from typing import Any, Callable, Type
from pydantic import BaseModel
import inspect
import contextlib
import io
import asyncio
from automcp.adapters.utils import ensure_serializable

def create_crewai_tool_adapter(
    tool_instance: Any,
    name: str,
    description: str,
    input_schema: Type[BaseModel],
) -> Callable:
    """
    Convert a CrewAI tool instance to an MCP tool, making it async.

    Args:
        tool_instance: The CrewAI tool instance
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

    target_run_method = '_run'
    is_run_async = False

    if hasattr(tool_instance, target_run_method):
        run_method = getattr(tool_instance, target_run_method)
        if callable(run_method):
            is_run_async = inspect.iscoroutinefunction(run_method)
        else:
            raise ValueError(f"Attribute '{target_run_method}' of class {tool_instance.__name__} must be callable")
    else:
        raise ValueError(f"Class {tool_instance.__name__} must have a '{target_run_method}' method")


    # Determine await keyword based on whether the target is async
    await_kw = "await " if is_run_async else ""

    # Create appropriate async function body
    body_str = f"""async def crewai_tool({params_str}):
            # Create input instance from parameters
            input_data = input_schema({', '.join(f'{name}={name}' for name in schema_fields)})
            input_dict = input_data.model_dump()

            # Get the method to call (run)
            run_func = getattr(tool_instance, '{target_run_method}')

            with contextlib.redirect_stdout(io.StringIO()):
                result = {await_kw}run_func(**input_dict)
                result = ensure_serializable(result)
            return result
        """

    namespace = {
        "input_schema": input_schema,
        "tool_instance": tool_instance,
        "contextlib": contextlib,
        "io": io,
        "asyncio": asyncio, 
        "inspect": inspect,
        "ensure_serializable": ensure_serializable
    }

    exec(body_str, namespace)

    # Get the created async function
    crewai_tool_async = namespace["crewai_tool"]

    # Add proper function metadata
    crewai_tool_async.__name__ = name
    crewai_tool_async.__doc__ = description

    return crewai_tool_async
