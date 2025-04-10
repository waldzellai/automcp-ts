from typing import Any, Callable, Type
from pydantic import BaseModel
import inspect
import contextlib
import io
import asyncio
from typing import Optional
from automcp.adapters.utils import ensure_serializable

POSSIBLE_RUN_METHODS = ["run", "results", "load"]


def create_langchain_tool_adapter(
    tool_instance: Any,
    name: str,
    description: str,
    input_schema: Type[BaseModel],
    run_func: Optional[str] = None,
) -> Callable:
    """
    Convert a Langchain tool instance to an MCP tool, making it async.

    Args:
        tool_instance: The Langchain tool instance
        run_func: The name of the function to run
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

    is_run_async = False

    if run_func is None:
        for run_method in POSSIBLE_RUN_METHODS:
            if hasattr(tool_instance, run_method):
                run_func = run_method
                break

    if run_func is None:
        raise ValueError(f"Class {tool_instance.__name__} must have a '{run_func}' method")

    if hasattr(tool_instance, run_func):
        run_method = getattr(tool_instance, run_func)
        if callable(run_method):
            is_run_async = inspect.iscoroutinefunction(run_method)
            target_callable = run_method
        else:
            raise ValueError(f"Attribute '{run_func}' of class {tool_instance.__name__} must be callable")
    else:
        raise ValueError(f"Class {tool_instance.__name__} must have a '{run_func}' method")


    # Determine await keyword based on whether the target is async
    await_kw = "await " if is_run_async else ""

    # Create appropriate async function body
    body_str = f"""async def run_tool({params_str}):
            # Create input instance from parameters
            input_data = input_schema({', '.join(f'{name}={name}' for name in schema_fields)})
            input_dict = input_data.model_dump()

            # Get the method to call (run)
            run_func = getattr(tool_instance, '{run_func}')

            with contextlib.redirect_stdout(io.StringIO()):
                result = {await_kw}run_func(**input_dict)
            return result
        """

    namespace = {
        "input_schema": input_schema,
        "tool_instance": tool_instance,
        "contextlib": contextlib,
        "io": io,
        "asyncio": asyncio, 
        "inspect": inspect,
        "ensure_serializable": ensure_serializable,
    }

    exec(body_str, namespace)

    # Get the created async function
    run_tool = namespace["run_tool"]

    # Add proper function metadata
    run_tool.__name__ = name
    run_tool.__doc__ = description

    return run_tool

