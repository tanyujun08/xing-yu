export interface ProblemPayload {
  code: string;
  message: string;
  request_id: string;
  details?: Record<string, unknown>;
}

export class ApiProblem extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(status: number, payload: ProblemPayload) {
    super(payload.message);
    this.name = 'ApiProblem';
    this.status = status;
    this.code = payload.code;
    this.requestId = payload.request_id;
    this.details = payload.details;
  }
}

export function isProblemPayload(value: unknown): value is ProblemPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.request_id === 'string'
  );
}
