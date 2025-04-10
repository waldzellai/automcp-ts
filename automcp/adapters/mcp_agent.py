from typing import Any, Callable, Type
from pydantic import BaseModel
import asyncio
import inspect


def create_mcp_agent_adapter(
    agent_instance: Any,
    llm: Any,
    app: Any,
    app_initialize_fn: Callable,
    name: str,
    description: str,
    input_schema: Type[BaseModel],
) -> Callable:
    """
    Convert a MCP agent instance to an MCP tool with proper isolation from MCP's task management.
    """
    # Define the wrapper function
    async def run_agent(**kwargs):
        # Create input object from schema
        input_data = input_schema(**kwargs)
        
        # Create a future that we can use to communicate between tasks
        result_future = asyncio.Future()
        
        async def isolated_agent_task():
            """Run the agent in an isolated context"""
            try:
                # Initialize the app
                await app_initialize_fn(app)
                
                # Attach LLM to the agent
                llm_instance = await agent_instance.attach_llm(llm)
                
                # Execute the main operation
                response = await llm_instance.generate_str(input_data.query)
                
                # Set the result if the future is not done yet
                if not result_future.done():
                    result_future.set_result(response)
            except Exception as e:
                # Set exception if the future is not done yet
                if not result_future.done():
                    result_future.set_exception(e)
        
        # Run the agent task in a new task
        task = asyncio.create_task(isolated_agent_task())
        
        try:
            # Wait for the result or an exception
            return await result_future
        except asyncio.CancelledError:
            # If our wrapper gets cancelled, cancel the agent task too
            task.cancel()
            raise
        except Exception as e:
            # Log any other exceptions but don't re-raise
            import traceback
            traceback.print_exc()
            return {"status": "error", "message": str(e)}
    
    # Create a function with the proper signature
    params = []
    for field_name, field_info in input_schema.model_fields.items():
        param = inspect.Parameter(
            name=field_name,
            kind=inspect.Parameter.POSITIONAL_OR_KEYWORD,
            annotation=field_info.annotation
        )
        params.append(param)
    
    run_agent.__signature__ = inspect.Signature(parameters=params)
    run_agent.__name__ = name
    run_agent.__doc__ = description
    
    return run_agent