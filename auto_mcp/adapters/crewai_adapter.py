from typing import Any, Callable, Type
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP
import json
import contextlib
import io

from auto_mcp.core.adapter_base import BaseMCPAdapter


class CrewAIAdapter(BaseMCPAdapter):
    """Adapter for converting CrewAI classes to MCP tools."""
    
    def convert_to_mcp_tool(
        self,
        framework_obj: Any,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
    ) -> Callable:
        """
        Convert a CrewAI class to an MCP tool.
        
        Args:
            framework_obj: The CrewAI class to convert
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
                result = framework_obj().kickoff(inputs=inputs.model_dump())
            return result.model_dump_json()
        """

        # Create a namespace for the function
        namespace = {
            "input_schema": input_schema,
            "framework_obj": framework_obj,
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
    
    def add_to_mcp(
        self,
        mcp: FastMCP,
        framework_obj: Any,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
    ) -> None:
        """
        Add a CrewAI class to an MCP server.
        
        Args:
            mcp: The MCP server instance
            framework_obj: The CrewAI class to add
            name: The name of the MCP tool
            description: The description of the MCP tool
            input_schema: The Pydantic model class defining the input schema
        """
        tool = self.convert_to_mcp_tool(
            framework_obj=framework_obj,
            name=name,
            description=description,
            input_schema=input_schema,
        )
        mcp.add_tool(
            tool,
            name=name,
            description=description,
        )