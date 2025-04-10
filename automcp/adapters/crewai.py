from typing import Any, Callable, Type
from pydantic import BaseModel
import json
import contextlib
import io
import asyncio
import inspect
from automcp.adapters.utils import ensure_serializable

def create_crewai_agent_adapter(
    agent_instance: Any,
    task_instance: Any,
    name: str,
    description: str,
    input_schema: Type[BaseModel],
) -> Callable:
        """
        Convert a CrewAI agent and task to an MCP tool.
        
        Args:
            agent_instance: The CrewAI agent instance to use
            task_instance: The CrewAI task instance to use
            name: The name of the MCP tool
            description: The description of the MCP tool
            input_schema: The Pydantic model class defining the input schema
            
        Returns:
            A callable function that can be used as an MCP tool
        """
        # Get the field names and types from the input schema
        schema_fields = input_schema.model_fields

        # Create the parameter string for the function signature
        params_str = ", ".join(
            f"{field_name}: {field_info.annotation.__name__}"
            for field_name, field_info in schema_fields.items()
        )

        # Create the function body that constructs the input schema and runs the agent with the task
        body_str = f"""def run_agent({params_str}):
            from crewai import Crew
            
            inputs = input_schema({', '.join(f'{name}={name}' for name in schema_fields)})
            
            # Create the agent and task instances
            agent = agent_instance
            task = task_instance
            
            # Create a simple crew with the single agent and task
            crew = Crew(
                agents=[agent],
                tasks=[task],
                verbose=False
            )
            
            # Run the crew and capture the output
            with contextlib.redirect_stdout(io.StringIO()):
                result = crew.kickoff(inputs=inputs.model_dump())
            
            return result.model_dump_json()
        """

        # Create a namespace for the function
        namespace = {
            "input_schema": input_schema,
            "agent_instance": agent_instance,
            "task_instance": task_instance,
            "json": json,
            "contextlib": contextlib,
            "io": io,
        }

        # Execute the function definition in the namespace
        exec(body_str, namespace)

        # Get the created function
        run_agent = namespace["run_agent"]

        # Add proper function metadata
        run_agent.__name__ = name
        run_agent.__doc__ = description

        return run_agent


def create_crewai_orchestrator_adapter(
    orchestrator_instance: Any,
    name: str,
    description: str,
    input_schema: Type[BaseModel],
) -> Callable:
        """
        Convert a CrewAI class to an MCP tool.
        
        Args:
            orchestrator_instance: The CrewAI class to convert
            name: The name of the MCP tool
            description: The description of the MCP tool
            input_schema: The Pydantic model class defining the input schema
            
        Returns:
            A callable function that can be used as an MCP tool
        """
        # Get the field names and types from the input schema
        schema_fields = input_schema.model_fields

        # Create the parameter string for the function signature
        params_str = ", ".join(
            f"{field_name}: {field_info.annotation.__name__}"
            for field_name, field_info in schema_fields.items()
        )

        # Create the function body that constructs the input schema
        body_str = f"""def run_orchestrator({params_str}):
            inputs = input_schema({', '.join(f'{name}={name}' for name in schema_fields)})
            with contextlib.redirect_stdout(io.StringIO()):
                result = orchestrator_instance.kickoff(inputs=inputs.model_dump())
            return result.model_dump_json()
        """

        # Create a namespace for the function
        namespace = {
            "input_schema": input_schema,
            "orchestrator_instance": orchestrator_instance,
            "json": json,
            "contextlib": contextlib,
            "io": io,
        }

        # Execute the function definition in the namespace
        exec(body_str, namespace)

        # Get the created function
        run_orchestrator = namespace["run_orchestrator"]

        # Add proper function metadata
        run_orchestrator.__name__ = name
        run_orchestrator.__doc__ = description

        return run_orchestrator


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
    body_str = f"""async def run_tool({params_str}):
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
    run_tool = namespace["run_tool"]

    # Add proper function metadata
    run_tool.__name__ = name
    run_tool.__doc__ = description

    return run_tool