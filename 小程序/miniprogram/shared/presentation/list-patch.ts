export function buildIncrementalListPatch<T>(
  dataPath: string,
  startIndex: number,
  rows: readonly T[],
): Record<string, T> {
  const normalizedPath = dataPath.trim();
  if (!normalizedPath) throw new Error('List data path is required');
  if (!Number.isSafeInteger(startIndex) || startIndex < 0) throw new Error('List start index must be a non-negative integer');
  return Object.fromEntries(rows.map((row, index) => [`${normalizedPath}[${startIndex + index}]`, row]));
}
