import type { components, RentalReviewInput } from '../../shared/services/rentalOrders';
export function systemOvertimeInput(receiptVersion: string | null): RentalReviewInput {
  return { decision: 'REVIEW_PENDING', receipt_version: receiptVersion, overtime_assessed_fen: null, adjustment_reason: null, loss_items: [], rejection_reason: '只读计算系统超期', missing_items: [], evidence_ids: [] };
}
export function reviewOvertimeValue(draft: string | null, preview: components['schemas']['ReviewPreview'] | undefined, orderVersion: string): string {
  // A key-bound query may arrive after typing or after an ORDER change. Neither
  // a late response nor an unknown amount may replace an explicit user draft.
  if (draft !== null) return draft;
  const raw = preview?.basis_version === orderVersion ? preview.overtime_fen : null;
  if (raw === null || raw === undefined || !/^(0|[1-9]\d*)$/.test(raw)) return '';
  const fen = BigInt(raw);
  return `${fen / 100n}.${String(fen % 100n).padStart(2, '0')}`;
}
export function yuanToFen(value: string): string | null {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const fen = BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
  return fen <= 9223372036854775807n ? String(fen) : null;
}
export function utcToBeijingInput(value: string | null): string {
  if (!value) return '';
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? new Date(millis + 8 * 3600000).toISOString().slice(0, 16) : '';
}
export function beijingInputToUTC(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const date = new Date(value + '+08:00');
  if (!Number.isFinite(date.getTime())) return null;
  // Reject normalized invalid calendar days such as February 30.
  const actual = new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, value.length);
  return actual === value ? date.toISOString() : null;
}
export function validReview(input: RentalReviewInput): boolean {
  const reason = (value: string | null) => value !== null && value.trim().length >= 1 && value.length <= 500;
  const final = input.decision === 'APPROVE_FINAL';
  if (final && (input.receipt_version === null || input.overtime_assessed_fen === null || input.missing_items.length > 0 || input.rejection_reason !== null)) return false;
  if (!final && !reason(input.rejection_reason)) return false;
  if (input.decision === 'MATERIAL_REQUIRED' && (input.receipt_version === null || input.missing_items.length === 0)) return false;
  if (input.missing_items.length > 20 || input.missing_items.some(v => !/^[a-z][a-z0-9-]{0,63}$/.test(v.slot_key) || !Number.isInteger(v.item_no) || v.item_no < 1 || v.item_no > 20 || !reason(v.reason)) || new Set(input.missing_items.map(v => v.slot_key + ':' + v.item_no)).size !== input.missing_items.length) return false;
  return input.loss_items.every((item) => reason(item.description) && (!final || item.confirmed_fen !== null) && (item.confirmed_fen === null || BigInt(item.confirmed_fen) === 0n || item.evidence_ids.length > 0));
}
