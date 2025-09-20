import { Data } from 'effect';

/** Error raised when input validation fails. */
export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly message: string;
  readonly issues?: readonly string[];
  readonly cause?: unknown;
}> {}

/** Error raised when the underlying agent execution fails. */
export class ExecutionError extends Data.TaggedError('ExecutionError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/** Error raised when the agent result cannot be serialized safely. */
export class SerializationError extends Data.TaggedError('SerializationError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type ToolExecutionError =
  | ValidationError
  | ExecutionError
  | SerializationError;
