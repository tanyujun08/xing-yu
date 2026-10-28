/** A preview always keeps the total and the need for its existing full-list entry. */
export function listPreview<T>(items: readonly T[], limit: number): { items: T[]; total: number; hasMore: boolean } {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Preview limit must be a positive integer');
  return { items: items.slice(0, limit), total: items.length, hasMore: items.length > limit };
}
