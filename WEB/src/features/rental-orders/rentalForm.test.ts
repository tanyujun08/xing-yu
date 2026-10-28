import { describe, expect, it } from 'vitest';
import { beijingInputToUTC, reviewOvertimeValue, systemOvertimeInput, validReview, yuanToFen, utcToBeijingInput } from './rentalForm';
import type { components, RentalReviewInput } from '../../shared/services/rentalOrders';
const process: RentalReviewInput = { decision: 'REVIEW_PENDING', receipt_version: null, overtime_assessed_fen: null, adjustment_reason: null, loss_items: [], rejection_reason: '需核实设备情况', missing_items: [], evidence_ids: [] };
describe('rental administrative input boundaries', () => {
  it('reads system overtime without mutating a review and preserves typed, cleared and newer-version drafts', () => {
    const calculation = systemOvertimeInput('4');
    expect(calculation.decision).toBe('REVIEW_PENDING'); expect(calculation.overtime_assessed_fen).toBeNull(); expect(calculation.loss_items).toEqual([]);
    const value: components['schemas']['ReviewPreview'] = { basis_version: '7', deposit_fen: '50000', overtime_fen: '12301', loss_fen: null, deducted_fen: null, refund_due_fen: null, supplement_due_fen: null, blockers: [] };
    expect(reviewOvertimeValue(null, value, '7')).toBe('123.01');
    expect(reviewOvertimeValue('75.00', value, '7')).toBe('75.00'); expect(reviewOvertimeValue('', value, '7')).toBe('');
    expect(reviewOvertimeValue(null, value, '8')).toBe('');
    expect(reviewOvertimeValue(null, { ...value, overtime_fen: null }, '7')).toBe('');
    expect(reviewOvertimeValue(null, { ...value, overtime_fen: '0' }, '7')).toBe('0.00');
    expect(process.rejection_reason).toBe('需核实设备情况');
  });
  it('keeps unknown and zero distinct and converts without floating point rounding', () => {
    expect(yuanToFen('')).toBeNull(); expect(yuanToFen('0')).toBe('0'); expect(yuanToFen('2.01')).toBe('201');
    expect(yuanToFen('92233720368547758.07')).toBe('9223372036854775807');
    for (const value of ['1e2', '-1', '01', '1.234', '92233720368547758.08', 'Infinity']) expect(yuanToFen(value)).toBeNull();
  });
  it('uses explicit Beijing time and rejects normalized invalid calendar input', () => {
    expect(beijingInputToUTC('2026-10-06T08:30')).toBe('2026-10-06T00:30:00.000Z');
    expect(beijingInputToUTC('2026-02-30T08:30')).toBeNull(); expect(beijingInputToUTC('')).toBeNull();
    expect(utcToBeijingInput('2026-10-06T00:30:00Z')).toBe('2026-10-06T08:30');
    expect(utcToBeijingInput(null)).toBe(''); expect(utcToBeijingInput('invalid')).toBe('');
  });
  it('allows process audit before receipt without forcing a final fee or preview', () => {
    expect(validReview(process)).toBe(true); expect(validReview({ ...process, rejection_reason: ' ' })).toBe(false);
    expect(validReview({ ...process, decision: 'MATERIAL_REQUIRED', missing_items: [{ slot_key: 'front', item_no: 1, evidence_id: null, reason: '拍清正面' }] })).toBe(false);
    expect(validReview({ ...process, decision: 'MATERIAL_REQUIRED', receipt_version: '2', missing_items: [{ slot_key: 'front', item_no: 1, evidence_id: null, reason: '拍清正面' }] })).toBe(true);
  });
  it('requires a receipt version and all confirmed losses with their own evidence for FINAL', () => {
    const final: RentalReviewInput = { ...process, decision: 'APPROVE_FINAL', rejection_reason: null, receipt_version: '2', overtime_assessed_fen: '0' };
    expect(validReview(final)).toBe(true); expect(validReview({ ...final, overtime_assessed_fen: null })).toBe(false);
    expect(validReview({ ...final, loss_items: [{ description: '外壳损坏', confirmed_fen: '1', evidence_ids: [] }] })).toBe(false);
    expect(validReview({ ...final, loss_items: [{ description: '外壳损坏', confirmed_fen: '1', evidence_ids: ['ready-original-material'] }] })).toBe(true);
  });
});
