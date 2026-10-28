import { validLoyaltyId, type ParsedInput } from './loyaltyInputs';

const cursorKey = 'cursor';
const previousKey = '_previous_cursor';

export function applyLoyaltyRecordFilters(previous: URLSearchParams, filterKeys: readonly string[], values: Readonly<Record<string, string>>): URLSearchParams {
  const next = new URLSearchParams(previous);
  for (const key of filterKeys) {
    next.delete(key);
    const value = values[key];
    if (value !== undefined && value !== '') next.set(key, value);
  }
  next.delete(cursorKey);
  next.delete(previousKey);
  return next;
}

export function readLoyaltyRecordFilters(search: URLSearchParams, filterKeys: readonly string[]): ParsedInput<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const key of [...filterKeys, cursorKey]) {
    if (search.getAll(key).length > 1) return { ok: false, message: `查询条件 ${key} 重复，请重新查询。` };
    const value = search.get(key);
    if (value !== null && value !== '') values[key] = value;
  }
  return { ok: true, value: values };
}

export function nextLoyaltyRecordPage(previous: URLSearchParams, nextCursor: string | null): URLSearchParams {
  const next = new URLSearchParams(previous);
  if (nextCursor === null || nextCursor === '') return next;
  next.delete(cursorKey);
  next.append(previousKey, previous.get(cursorKey) ?? '');
  next.set(cursorKey, nextCursor);
  return next;
}

export function previousLoyaltyRecordPage(previous: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(previous);
  const history = previous.getAll(previousKey);
  if (history.length === 0) return next;
  const cursor = history.pop();
  next.delete(previousKey);
  next.delete(cursorKey);
  for (const item of history) next.append(previousKey, item);
  if (cursor === undefined || cursor === '') next.delete(cursorKey);
  else next.set(cursorKey, cursor);
  return next;
}

export function openLoyaltyDetail(previous: URLSearchParams, kind: string, id: string): ParsedInput<URLSearchParams> {
  if (!validLoyaltyId(id)) return { ok: false, message: '请输入有效的精确记录编号。' };
  const next = new URLSearchParams(previous);
  next.set('detail_kind', kind);
  next.set('detail_id', id);
  return { ok: true, value: next };
}

export function closeLoyaltyDetail(previous: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(previous);
  next.delete('detail_kind'); next.delete('detail_id');
  return next;
}
