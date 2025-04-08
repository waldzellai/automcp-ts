from typing import Any, Callable, Type
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP
import inspect
import contextlib
import io
import asyncio
from auto_mcp.core.adapter_base import BaseMCPAdapter

class OpenAIAdapter(BaseMCPAdapter):
    """Adapter for converting OpenAI agents to MCP tools."""
    
    def convert_to_mcp_tool(
        self,
        framework_obj: Any,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
    ) -> Callable:
        """
        Convert an OpenAI agent to an MCP tool.
        
        Args:
            framework_obj: The OpenAI agent to convert
            name: The name of the MCP tool
            description: The description of the MCP tool
            input_schema: The Pydantic model class defining the input schema
            
        Returns:
            An async callable function that can be used as an MCP tool
        """
        schema_fields = input_schema.model_fields
        params_str = ", ".join(
            f"{field_name}: {field_info.annotation.__name__ if hasattr(field_info.annotation, '__name__') else 'Any'}"
            for field_name, field_info in schema_fields.items()
        )

        is_class = inspect.isclass(framework_obj)
        is_function = inspect.isfunction(framework_obj) or inspect.ismethod(framework_obj)

        # Method detection
        target_callable = None
        is_run_async = False

        if is_class:
            # Check for standard methods
            for method_name in ['run', 'arun', 'chat', 'achat', 'invoke', 'ainvoke']:
                if hasattr(framework_obj, method_name):
                    method = getattr(framework_obj, method_name)
                    if callable(method):
                        is_run_async = inspect.iscoroutinefunction(method)
                        target_callable = method_name
                        break
            if not target_callable:
                raise ValueError(f"Class {framework_obj.__name__} must have one of: run, arun, chat, achat, invoke, or ainvoke methods")
        elif is_function:
            is_run_async = inspect.iscoroutinefunction(framework_obj)
            target_callable = framework_obj
        else:
            raise ValueError(f"Unsupported framework object type: {type(framework_obj)}")

        # Determine await keyword based on whether the target is async
        await_kw = "await " if is_run_async else ""

        # Create appropriate async function body
        if is_class:
            body_str = f"""async def openai_tool({params_str}):
                # Create input instance from parameters
                input_data = input_schema({', '.join(f'{name}={name}' for name in schema_fields)})
                input_dict = input_data.model_dump()
                
                # Initialize the class
                agent_instance = framework_obj()
                
                # Get the method to call
                run_func = getattr(agent_instance, '{target_callable}')
                
                with contextlib.redirect_stdout(io.StringIO()):
                    result = {await_kw}run_func(**input_dict)
                
                # Ensure result is in a consistent format
                if isinstance(result, dict):
                    return result
                return {{"response": str(result)}}
            """
        elif is_function:
            body_str = f"""async def openai_tool({params_str}):
                # Create input instance from parameters
                input_data = input_schema({', '.join(f'{name}={name}' for name in schema_fields)})
                input_dict = input_data.model_dump()
                
                with contextlib.redirect_stdout(io.StringIO()):
                    result = {await_kw}framework_obj(**input_dict)
                
                # Ensure result is in a consistent format
                if isinstance(result, dict):
                    return result
                return {{"response": str(result)}}
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
        
        openai_tool_async = namespace["openai_tool"]
        
        openai_tool_async.__name__ = name
        openai_tool_async.__doc__ = description
        
        return openai_tool_async
    
    def add_to_mcp(
        self,
        mcp: FastMCP,
        framework_obj: Any,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
    ) -> None:
        """
        Add an OpenAI agent to an MCP server.
        
        Args:
            mcp: The MCP server instance
            framework_obj: The OpenAI agent to add
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
