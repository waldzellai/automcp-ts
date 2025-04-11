from typing import Any, Callable, Type
from pydantic import BaseModel
import asyncio
import contextlib
import io


def create_pydantic_adapter(
    agent_instance: Any,
    name: str,
    description: str,
    input_schema: Type[BaseModel],
) -> Callable:
    """
    Convert a Pydantic agent instance to an MCP tool, making it async.

    Args:
        agent_instance: The Pydantic agent instance
        name: The name of the MCP tool
        description: The description of the MCP tool
        input_schema: The Pydantic model class defining the input schema

    Returns:
        An awaitable callable function that can be used as an MCP tool
    """
    # Get the input schema fields to preserve the signature
    schema_fields = input_schema.model_fields
    
    # Create the parameter string for the function signature
    params_str = ", ".join(
        f"{field_name}: {field_info.annotation.__name__ if hasattr(field_info.annotation, '__name__') else 'Any'}"
        for field_name, field_info in schema_fields.items()
    )

    # Create the function body with proper async/await
    body_str = f"""async def run_agent({params_str}):
        # Create the input object
        input_data = input_schema({', '.join(f'{name}={name}' for name in schema_fields)})
        
        # Call the async run method
        with contextlib.redirect_stdout(io.StringIO()):
            result = await agent_instance.run(input_data.query)
        
        # Process the result
        if hasattr(result, 'data'):
            return result.data
        elif hasattr(result, 'raw'):
            return result.raw
        else:
            return result
    """

    # Create a namespace for the exec
    namespace = {
        "input_schema": input_schema,
        "agent_instance": agent_instance,
        "asyncio": asyncio,
        "contextlib": contextlib,
        "io": io,
    }
    
    # Execute the function definition
    exec(body_str, namespace)
    
    # Get the created function
    run_agent = namespace["run_agent"]
    
    # Add metadata
    run_agent.__name__ = name
    run_agent.__doc__ = description
    
    return run_agent

