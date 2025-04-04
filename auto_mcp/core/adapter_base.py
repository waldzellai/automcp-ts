from abc import ABC, abstractmethod
from typing import Any, Callable, Type
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP


class BaseMCPAdapter(ABC):
    """Base class for all framework adapters to MCP."""
    
    @abstractmethod
    def convert_to_mcp_tool(
        self,
        framework_obj: Any,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
    ) -> Callable:
        """
        Convert a framework-specific object to an MCP tool.
        
        Args:
            framework_obj: The framework-specific object to convert
            name: The name of the MCP tool
            description: The description of the MCP tool
            input_schema: The Pydantic model class defining the input schema
            
        Returns:
            A callable function that can be used as an MCP tool
        """
        pass
    
    @abstractmethod
    def add_to_mcp(
        self,
        mcp: FastMCP,
        framework_obj: Any,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
    ) -> None:
        """
        Add a framework-specific object to an MCP server.
        
        Args:
            mcp: The MCP server instance
            framework_obj: The framework-specific object to add
            name: The name of the MCP tool
            description: The description of the MCP tool
            input_schema: The Pydantic model class defining the input schema
        """
        pass