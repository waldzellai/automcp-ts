from typing import Any, Union, Dict, List

def ensure_serializable(obj: Any) -> Union[Dict, List, str, int, float, bool, None]:
    """
    Ensure an object is JSON serializable by converting if necessary.
    """
    # If already a basic type, return as is
    if isinstance(obj, (dict, list, str, int, float, bool, type(None))):
        # If it's a dict, recursively ensure all values are serializable
        if isinstance(obj, dict):
            return {k: ensure_serializable(v) for k, v in obj.items()}
        # If it's a list, recursively ensure all items are serializable
        elif isinstance(obj, list):
            return [ensure_serializable(item) for item in obj]
        # Otherwise return as is
        return obj
    
    # Try various conversion methods
    try:
        # Try to convert to dict if it has a to_dict method
        if hasattr(obj, "to_dict") and callable(obj.to_dict):
            return ensure_serializable(obj.to_dict())
        
        # Try to convert to dict if it has a model_dump method (Pydantic)
        elif hasattr(obj, "model_dump") and callable(obj.model_dump):
            return ensure_serializable(obj.model_dump())
        
        # Try to convert to dict if it has an asdict method (dataclasses)
        elif hasattr(obj, "__dict__"):
            # Filter out private attributes
            return ensure_serializable({
                k: v for k, v in obj.__dict__.items() 
                if not k.startswith('_')
            })
        
        # For objects with a results attribute (common in search tools)
        elif hasattr(obj, "results"):
            results = obj.results
            if isinstance(results, list):
                return [ensure_serializable(item) for item in results]
            else:
                return ensure_serializable(results)
                
    except Exception:
        # If conversion fails, fall back to string representation
        return str(obj)
        
    # If no conversion method worked, fall back to string
    return str(obj)