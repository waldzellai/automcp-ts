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
        Convert a function to an MCP tool, preserving parameter types and handling async properly.
        """
        # Determine if the framework object is async
        is_async = inspect.iscoroutinefunction(framework_obj)
        
        # Build a function signature dynamically to preserve type hints
        async def wrapper(**kwargs):
            try:
                # Validate input using the schema
                input_data = input_schema(**kwargs)
                input_dict = input_data.model_dump()
                
                # Execute the target function with appropriate async handling
                if is_async:
                    # Use create_task to ensure proper task isolation
                    task = asyncio.create_task(framework_obj(**input_dict))
                    # Wait for the task to complete
                    result = await task
                else:
                    # For non-async functions, run directly
                    result = framework_obj(**input_dict)
                    
                return result
            except Exception as e:
                # Proper error handling is important for async tasks
                print(f"Error in tool execution: {e}")
                raise
        
        # Create a function with the proper signature
        sig = inspect.signature(framework_obj)
        # Keep only parameters that exist in the schema
        schema_params = {k: v for k, v in sig.parameters.items() 
                        if k in input_schema.model_fields}
        
        # Apply the correct signature to our wrapper function
        wrapper.__signature__ = sig.replace(parameters=list(schema_params.values()))
        wrapper.__name__ = name
        wrapper.__doc__ = description
        
        return wrapper

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