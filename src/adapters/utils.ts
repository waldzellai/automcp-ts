type SerializableValue = Record<string, any> | any[] | string | number | boolean | null;

interface HasToDict {
  to_dict(): any;
}

interface HasModelDump {
  model_dump(): any;
}

interface HasResults {
  results: any;
}

function hasToDict(obj: any): obj is HasToDict {
  return obj && typeof obj.to_dict === 'function';
}

function hasModelDump(obj: any): obj is HasModelDump {
  return obj && typeof obj.model_dump === 'function';
}

function hasResults(obj: any): obj is HasResults {
  return obj && 'results' in obj;
}

function isPlainObject(obj: any): obj is Record<string, any> {
  return obj && typeof obj === 'object' && obj.constructor === Object;
}

/**
 * Ensure an object is JSON serializable by converting if necessary.
 */
export function ensureSerializable(obj: any): SerializableValue {
  // If already a basic type, return as is
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => ensureSerializable(item));
  }
  
  if (isPlainObject(obj)) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, ensureSerializable(v)])
    );
  }
  
  // Try various conversion methods
  try {
    // Try to convert to dict if it has a to_dict method
    if (hasToDict(obj)) {
      return ensureSerializable(obj.to_dict());
    }
    
    // Try to convert to dict if it has a model_dump method (Pydantic)
    if (hasModelDump(obj)) {
      return ensureSerializable(obj.model_dump());
    }
    
    // Try to convert to dict if it has properties (similar to __dict__)
    if (typeof obj === 'object' && obj !== null) {
      // Filter out private attributes (starting with _) and functions
      const filtered = Object.fromEntries(
        Object.entries(obj).filter(([k, v]) => 
          !k.startsWith('_') && typeof v !== 'function'
        )
      );
      return ensureSerializable(filtered);
    }
    
    // For objects with a results attribute (common in search tools)
    if (hasResults(obj)) {
      const results = obj.results;
      if (Array.isArray(results)) {
        return results.map(item => ensureSerializable(item));
      } else {
        return ensureSerializable(results);
      }
    }
        
  } catch (error) {
    // If conversion fails, fall back to string representation
    return String(obj);
  }
  
  // If no conversion method worked, fall back to string
  return String(obj);
} 