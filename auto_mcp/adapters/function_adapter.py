# langgraph_adapter.py (Modified)

from typing import Any, Callable, Type
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP
import inspect
import contextlib
import io
import asyncio # Keep asyncio import
from auto_mcp.core.adapter_base import BaseMCPAdapter


class FunctionAdapter(BaseMCPAdapter):
    """Adapter for converting functions to MCP tools."""

    def convert_to_mcp_tool(
        self,
        framework_obj: Any,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
    ) -> Callable:
        """
        Convert a function to an MCP tool, making it async.

        Args:
            framework_obj: The function to convert
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

        is_run_async = inspect.iscoroutinefunction(framework_obj)

        # Determine await keyword based on whether the target is async
        await_kw = "await " if is_run_async else ""

        body_str = f"""async def function_tool({params_str}):
            # Create input instance from parameters
            input_data = input_schema({', '.join(f'{name}={name}' for name in schema_fields)})
            input_dict = input_data.model_dump()

            with contextlib.redirect_stdout(io.StringIO()):
                result = {await_kw}framework_obj(**input_dict)
            return result
            """

        namespace = {
            "input_schema": input_schema,
            "framework_obj": framework_obj,
            "contextlib": contextlib,
            "io": io,
            "asyncio": asyncio, 
            "inspect": inspect 
        }

        exec(body_str, namespace)

        # Get the created async function
        function_tool_async = namespace["function_tool"]

        # Add proper function metadata
        function_tool_async.__name__ = name
        function_tool_async.__doc__ = description

        return function_tool_async

    def add_to_mcp(
        self,
        mcp: FastMCP,
        framework_obj: Any,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
    ) -> None:
        """
        Add a function to an MCP server as an async tool.

        Args:
            mcp: The MCP server instance
            framework_obj: The function to convert
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
        # FastMCP should handle adding async functions correctly
        mcp.add_tool(
            tool,
            name=name,
            description=description,
        )