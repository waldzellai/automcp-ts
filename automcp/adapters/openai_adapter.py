import contextlib
import io
import asyncio
import inspect
from typing import Any, Callable, Type, Optional
from pydantic import BaseModel
from agents import Runner

def create_openai_agent_adapter(
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

    body_str = f"""async def openai_agent({params_str}):
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
    openai_agent = namespace["openai_agent"]
    openai_agent.__name__ = name
    openai_agent.__doc__ = description

    return openai_agent

def create_openai_orchestrator_adapter(
        main_agent_instance: Any,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
        run_before_func: Optional[Callable] = None,
        run_after_func: Optional[Callable] = None,
    ) -> Callable:
    """
    Convert OpenAI agents to an MCP tool, always running the main agent instance
    with optional pre- and post-execution hooks for other agents or processes.

    Args:
        main_agent_instance: The main agent instance that should always be executed.
        name: The name of the MCP tool.
        description: The description of the MCP tool.
        input_schema: The Pydantic model class defining the input schema.
        run_before_func: Optional custom function to execute before the main agent (default is None).
        run_after_func: Optional custom function to execute after the main agent (default is None).

    Returns:
        An async callable function that can be used as an MCP tool.
    """
    schema_fields = input_schema.model_fields

    params_str = ", ".join(
        f"{field_name}: {field_info.annotation.__name__ if hasattr(field_info.annotation, '__name__') else 'Any'}"
        for field_name, field_info in schema_fields.items()
    )

    # Start building the body of the dynamic function
    body_str = f"""async def openai_orchestrator({params_str}):
        input_data = input_schema({', '.join(f'{name}={name}' for name in schema_fields)})
        input_dict = input_data.model_dump()
        before_run_result = None

        # Optionally apply run_before_func if provided
        if 'run_before_func' in globals() and callable(run_before_func):
            before_run_result = await run_before_func(*list(input_dict.values()))

        # Execute the main agent
        with contextlib.redirect_stdout(io.StringIO()):
            if before_run_result:
                main_agent_result = await Runner.run(main_agent_instance, before_run_result.to_input_list())
            else:
                main_agent_result = await Runner.run(main_agent_instance, *list(input_dict.values()))

            # Optionally apply run_after_func if provided
            if 'run_after_func' in globals() and callable(run_after_func):
                result = await run_after_func(main_agent_result)
            else:
                result = main_agent_result

            print(result)

        return result.final_output
    """

    # Dynamically create the namespace
    namespace = {
        "input_schema": input_schema,
        "main_agent_instance": main_agent_instance,
        "contextlib": contextlib,
        "io": io,
        "asyncio": asyncio,
        "inspect": inspect,
        "Runner": Runner,
    }

    # Add the run_before_func and run_after_func to the namespace only if they are provided
    if run_before_func:
        namespace["run_before_func"] = run_before_func
    if run_after_func:
        namespace["run_after_func"] = run_after_func

    # Execute the dynamic code to create the function in the namespace
    exec(body_str, namespace)
    openai_orchestrator = namespace["openai_orchestrator"]
    openai_orchestrator.__name__ = name
    openai_orchestrator.__doc__ = description

    return openai_orchestrator
