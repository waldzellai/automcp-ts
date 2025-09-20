import { z, type AnyZodObject, type ZodTypeAny } from 'zod';

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

interface HasModelFields {
  model_fields?: Record<string, unknown>;
}

interface HasModelDumpMethod {
  model_dump?: () => Record<string, any>;
}

type SchemaRecord = Record<string, ZodTypeAny>;

export type SchemaLike = AnyZodObject | SchemaRecord | (HasModelFields & (new (data: any) => any));

function hasToDict(obj: any): obj is HasToDict {
  return obj && typeof obj.to_dict === 'function';
}

function hasModelDump(obj: any): obj is HasModelDump {
  return obj && typeof obj.model_dump === 'function';
}

function hasResults(obj: any): obj is HasResults {
  return obj && 'results' in obj;
}

function hasModelFields(schema: unknown): schema is HasModelFields {
  return Boolean(schema && typeof (schema as HasModelFields).model_fields === 'object');
}

function hasSchemaRecordValues(schema: unknown): schema is SchemaRecord {
  if (!isPlainObject(schema)) {
    return false;
  }
  return Object.values(schema as Record<string, unknown>).every(value => value instanceof z.ZodType);
}

function isZodObject(schema: unknown): schema is AnyZodObject {
  return schema instanceof z.ZodObject;
}

function isModelClass(schema: unknown): schema is new (data: any) => HasModelDumpMethod {
  return typeof schema === 'function';
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

export function extractParamsFromArgs(args: any[], schema?: SchemaLike): Record<string, any> {
  if (args.length === 1 && isPlainObject(args[0]) && !Array.isArray(args[0])) {
    return { ...(args[0] as Record<string, any>) };
  }

  if (!schema) {
    return Object.fromEntries(args.map((value, index) => [`arg${index}`, value]));
  }

  let fieldNames: string[] = [];
  if (isZodObject(schema)) {
    fieldNames = Object.keys(schema.shape);
  } else if (hasSchemaRecordValues(schema)) {
    fieldNames = Object.keys(schema);
  } else if (hasModelFields(schema)) {
    fieldNames = Object.keys(schema.model_fields ?? {});
  }

  const params: Record<string, any> = {};
  fieldNames.forEach((fieldName, index) => {
    if (index < args.length) {
      params[fieldName] = args[index];
    }
  });

  return params;
}

export function parseInputWithSchema(schema: SchemaLike | undefined, params: Record<string, any>): any {
  if (!schema) {
    return params;
  }

  if (isZodObject(schema)) {
    return schema.parse(params);
  }

  if (hasSchemaRecordValues(schema)) {
    return z.object(schema).parse(params);
  }

  if (isModelClass(schema)) {
    const instance = new schema(params);
    if (typeof instance?.model_dump === 'function') {
      return instance.model_dump();
    }
    if (typeof instance?.toJSON === 'function') {
      return instance.toJSON();
    }
    return instance;
  }

  return params;
}