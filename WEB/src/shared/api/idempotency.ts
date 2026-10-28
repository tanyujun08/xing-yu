import { randomId } from '../randomId';
export function newIdempotencyKey(scope: string): string {
  const normalizedScope = scope.trim().replace(/[^a-zA-Z0-9._:-]/g, '-');
  return `${normalizedScope}:${randomId()}`;
}
