function randomSegment(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function newRequestId(): string {
  return `mp_${Date.now().toString(36)}_${randomSegment()}`;
}

export function newIdempotencyKey(scope: string): string {
  const normalized = scope.trim().replace(/[^a-zA-Z0-9._:-]/g, '_');
  if (normalized.length === 0) {
    throw new Error('Idempotency key scope is required');
  }
  return `${normalized}:${Date.now().toString(36)}:${randomSegment()}`;
}
