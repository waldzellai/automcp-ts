import contextlib
import io
import asyncio
import inspect
from typing import Any, Callable, Type
from pydantic import BaseModel
from llama_index.core.workflow import Context
from automcp.adapters.utils import ensure_serializable

def create_llamaindex_agent_adapter(
    agent_instance: Any,
    name: str,
    description: str,
    input_schema: Type[BaseModel]
) -> Callable:
    """
    Convert LlamaIndex agents to an MCP tool
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
        ctx = Context(agent_instance)

        with contextlib.redirect_stdout(io.StringIO()):
            handler = agent_instance.run(*list(input_dict.values()), ctx=ctx)
            response = await handler
        return str(response)
    """

    namespace = {
        "input_schema": input_schema,
        "agent_instance": agent_instance,
        "Context": Context,
        "io": io,
        "asyncio": asyncio,
        "inspect": inspect,
        "contextlib": contextlib,
    }

    exec(body_str, namespace)
    run_agent = namespace["run_agent"]
    run_agent.__name__ = name
    run_agent.__doc__ = description

    return run_agent

def create_llamaindex_tool_adapter(
    tool_instance: Any,
    name: str,
    description: str,
    input_schema: Type[BaseModel],
    is_async_tool: bool = False
) -> Callable:
    """
    Convert LlamaIndex tools to an MCP tool
    Args:
        tool_instance: The tool instance to convert.
        name: The name of the MCP tool.
        description: The description of the MCP tool.
    """
    schema_fields = input_schema.model_fields

    params_str = ", ".join(
        f"{field_name}: {field_info.annotation.__name__ if hasattr(field_info.annotation, '__name__') else 'Any'}"
        for field_name, field_info in schema_fields.items()
    )

    await_kw = "await " if is_async_tool else ""
    target_run_method = "acall" if is_async_tool else "call"

    body_str = f"""{"async " if is_async_tool else ""}def run_tool({params_str}):
        input_data = input_schema({', '.join(f'{name}={name}' for name in schema_fields)})
        input_dict = input_data.model_dump()

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
        "contextlib": contextlib,
        "ensure_serializable": ensure_serializable
    }

    exec(body_str, namespace)
    run_tool = namespace["run_tool"]
    run_tool.__name__ = name
    run_tool.__doc__ = description

    return run_tool