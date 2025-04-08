# langgraph_adapter.py (Modified)

from typing import Any, Callable, Type, Union, Dict, List
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP
import inspect
import contextlib
import io
import asyncio # Keep asyncio import
from auto_mcp.core.adapter_base import BaseMCPAdapter


class CrewaiToolAdapter(BaseMCPAdapter):
    """Adapter for converting CrewAI objects to MCP tools."""

    def convert_to_mcp_tool(
        self,
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
                return result
            """

        namespace = {
            "input_schema": input_schema,
            "tool_instance": tool_instance,
            "contextlib": contextlib,
            "io": io,
            "asyncio": asyncio, 
            "inspect": inspect 
        }

        exec(body_str, namespace)

        # Get the created async function
        crewai_tool_async = namespace["crewai_tool"]

        # Add proper function metadata
        crewai_tool_async.__name__ = name
        crewai_tool_async.__doc__ = description

        return crewai_tool_async

    def _ensure_serializable(self, obj: Any) -> Union[Dict, List, str, int, float, bool, None]:
        """
        Ensure an object is JSON serializable by converting if necessary.
        """
        # If already a basic type, return as is
        if isinstance(obj, (dict, list, str, int, float, bool, type(None))):
            # If it's a dict, recursively ensure all values are serializable
            if isinstance(obj, dict):
                return {k: self._ensure_serializable(v) for k, v in obj.items()}
            # If it's a list, recursively ensure all items are serializable
            elif isinstance(obj, list):
                return [self._ensure_serializable(item) for item in obj]
            # Otherwise return as is
            return obj
        
        # Try various conversion methods
        try:
            # Try to convert to dict if it has a to_dict method
            if hasattr(obj, "to_dict") and callable(obj.to_dict):
                return self._ensure_serializable(obj.to_dict())
            
            # Try to convert to dict if it has a model_dump method (Pydantic)
            elif hasattr(obj, "model_dump") and callable(obj.model_dump):
                return self._ensure_serializable(obj.model_dump())
            
            # Try to convert to dict if it has an asdict method (dataclasses)
            elif hasattr(obj, "__dict__"):
                # Filter out private attributes
                return self._ensure_serializable({
                    k: v for k, v in obj.__dict__.items() 
                    if not k.startswith('_')
                })
            
            # For objects with a results attribute (common in search tools)
            elif hasattr(obj, "results"):
                results = obj.results
                if isinstance(results, list):
                    return [self._ensure_serializable(item) for item in results]
                else:
                    return self._ensure_serializable(results)
                    
        except Exception:
            # If conversion fails, fall back to string representation
            return str(obj)
            
        # If no conversion method worked, fall back to string
        return str(obj)

    def add_to_mcp(
        self,
        mcp: FastMCP,
        tool_instance: Any,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
    ) -> None:
        """
        Add a CrewAI tool instance to an MCP server as an async tool.

        Args:
            mcp: The MCP server instance
            tool_instance: The CrewAI tool instance
            name: The name of the MCP tool
            description: The description of the MCP tool
            input_schema: The Pydantic model class defining the input schema
        """
        tool = self.convert_to_mcp_tool(
            tool_instance=tool_instance,
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