from typing import Any, Callable, Type
from pydantic import BaseModel
import json
import contextlib
import io
import asyncio
import inspect
from automcp.adapters.utils import ensure_serializable

def create_crewai_adapter(
    agent_instance: Any,
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
        body_str = f"""def run_agent({params_str}):
            inputs = input_schema({', '.join(f'{name}={name}' for name in schema_fields)})
            with contextlib.redirect_stdout(io.StringIO()):
                result = agent_instance.kickoff(inputs=inputs.model_dump())
            return result.model_dump_json()
        """

        # Create a namespace for the function
        namespace = {
            "input_schema": input_schema,
            "agent_instance": agent_instance,
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

