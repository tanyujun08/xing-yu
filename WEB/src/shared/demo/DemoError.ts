export type DemoErrorCode =
  | 'DEMO_ENV_INVALID'
  | 'NETWORK_BLOCKED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'VALIDATION_FAILED'
  | 'CONFLICT'
  | 'INVALID_TRANSITION'
  | 'PERSISTENCE_INVALID'
  | 'UNKNOWN_NOT_RESOLVABLE';

export class DemoError extends Error {
  readonly code: DemoErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: DemoErrorCode, message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message);
    this.name = 'DemoError';
    this.code = code;
    this.details = details;
  }
}
