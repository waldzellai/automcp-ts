from typing import Any, Callable, Type
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP
import inspect
import contextlib
import io
from auto_mcp.core.adapter_base import BaseMCPAdapter

class LlamaIndexAdapter(BaseMCPAdapter):
    """Adapter for converting LlamaIndex agents and query engines to MCP tools."""
    
    def convert_to_mcp_tool(
        self,
        framework_obj: Any,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
    ) -> Callable:
        """
        Convert a LlamaIndex agent or query engine to an MCP tool.
        
        Args:
            framework_obj: The LlamaIndex agent or query engine to convert
            name: The name of the MCP tool
            description: The description of the MCP tool
            input_schema: The Pydantic model class defining the input schema
            
        Returns:
            An async callable function that can be used as an MCP tool
        """
        # Get the field names and types from the input schema
        schema_fields = input_schema.model_fields

        # Create the parameter string for the function signature
        params_str = ", ".join(
            f"{field_name}: {field_info.annotation.__name__ if hasattr(field_info.annotation, '__name__') else 'Any'}"
            for field_name, field_info in schema_fields.items()
        )

        # Check if the framework object is a class or instance
        is_class = inspect.isclass(framework_obj)
        is_instance = not is_class

        # Determine if the object has a run method
        has_run = hasattr(framework_obj, 'run') if is_instance else hasattr(framework_obj, 'run')
        has_aquery = hasattr(framework_obj, 'aquery') if is_instance else hasattr(framework_obj, 'aquery')

        if not (has_run or has_aquery):
            raise ValueError("LlamaIndex object must have either a 'run' or 'aquery' method")

        # Create the async function body
        body_str = f"""async def llamaindex_tool({params_str}):
            # Create input instance from parameters
            input_data = input_schema({', '.join(f'{name}={name}' for name in schema_fields)})
            input_dict = input_data.model_dump()
            
            # Get the query from input
            query = input_dict.get('query', '')
            
            # Initialize the agent/query engine if it's a class
            obj = framework_obj() if is_class else framework_obj
            
            # Run the appropriate method
            with contextlib.redirect_stdout(io.StringIO()):
                if has_run:
                    result = await obj.run(query)
                else:
                    result = await obj.aquery(query)
            
            return result
        """

        # Create a namespace for the function
        namespace = {
            "input_schema": input_schema,
            "framework_obj": framework_obj,
            "contextlib": contextlib,
            "io": io,
            "is_class": is_class,
            "has_run": has_run,
            "has_aquery": has_aquery,
        }

        # Execute the function definition in the namespace
        exec(body_str, namespace)

        # Get the created async function
        llamaindex_tool_async = namespace["llamaindex_tool"]

        # Add proper function metadata
        llamaindex_tool_async.__name__ = name
        llamaindex_tool_async.__doc__ = description

        return llamaindex_tool_async
    
    def add_to_mcp(
        self,
        mcp: FastMCP,
        framework_obj: Any,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
    ) -> None:
        """
        Add a LlamaIndex agent or query engine to an MCP server.
        
        Args:
            mcp: The MCP server instance
            framework_obj: The LlamaIndex agent or query engine to add
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