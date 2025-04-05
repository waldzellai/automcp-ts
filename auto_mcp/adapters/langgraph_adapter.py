# langgraph_adapter.py (Modified)

from typing import Any, Callable, Type
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP
import inspect
import contextlib
import io
import asyncio # Keep asyncio import
from auto_mcp.core.adapter_base import BaseMCPAdapter


class LangGraphAdapter(BaseMCPAdapter):
    """Adapter for converting LangGraph objects to MCP tools."""

    def convert_to_mcp_tool(
        self,
        framework_obj: Any,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
    ) -> Callable:
        """
        Convert a LangGraph object to an MCP tool, making it async.

        Args:
            framework_obj: The LangGraph class, function, or compiled graph
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

        is_class = inspect.isclass(framework_obj)
        is_function = inspect.isfunction(framework_obj) or inspect.ismethod(framework_obj)

        run_method_name = 'run' # Default method name for classes
        is_run_async = False
        target_callable = None

        if is_class:
            # Check for standard run methods first
            if hasattr(framework_obj, run_method_name):
                 run_method = getattr(framework_obj, run_method_name)
                 if callable(run_method):
                     is_run_async = inspect.iscoroutinefunction(run_method)
                     target_callable = run_method_name
                 else:
                     raise ValueError(f"Attribute '{run_method_name}' of class {framework_obj.__name__} must be callable")
            else:
                 # Maybe the class itself is callable (has __call__) or requires a specific async method?
                 # For now, stick to requiring a 'run' method. Add more sophisticated checks if needed.
                 raise ValueError(f"Class {framework_obj.__name__} must have a '{run_method_name}' method")

        elif is_function:
            is_run_async = inspect.iscoroutinefunction(framework_obj)
            target_callable = framework_obj
        else:
            raise ValueError(f"Unsupported framework object type: {type(framework_obj)}. Provide a class with 'run', a function, or a compiled graph with 'ainvoke'/'invoke'.")


        # Determine await keyword based on whether the target is async
        await_kw = "await " if is_run_async else ""

        # Create appropriate async function body
        if is_class:
            body_str = f"""async def langgraph_tool({params_str}):
                # Create input instance from parameters
                input_data = input_schema({', '.join(f'{name}={name}' for name in schema_fields)})
                input_dict = input_data.model_dump()

                # Initialize the class
                agent_instance = framework_obj()

                # Get the method to call (run)
                run_func = getattr(agent_instance, '{target_callable}')

                with contextlib.redirect_stdout(io.StringIO()):
                    result = {await_kw}run_func(**input_dict)
                return result
            """
        elif is_function:
             body_str = f"""async def langgraph_tool({params_str}):
                # Create input instance from parameters
                input_data = input_schema({', '.join(f'{name}={name}' for name in schema_fields)})
                input_dict = input_data.model_dump()

                with contextlib.redirect_stdout(io.StringIO()):
                    result = {await_kw}framework_obj(**input_dict)
                return result
            """
        else:
             raise ValueError("Internal error: Could not determine how to call the framework object.")


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
        langgraph_tool_async = namespace["langgraph_tool"]

        # Add proper function metadata
        langgraph_tool_async.__name__ = name
        langgraph_tool_async.__doc__ = description

        return langgraph_tool_async

    def add_to_mcp(
        self,
        mcp: FastMCP,
        framework_obj: Any,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
    ) -> None:
        """
        Add a LangGraph object to an MCP server as an async tool.

        Args:
            mcp: The MCP server instance
            framework_obj: The LangGraph class, function, or compiled graph
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