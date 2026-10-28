import { expect, it } from 'vitest';
import { ApiProblem } from '../api/problem';
import { isLoyaltySaveRejected, loyaltyFailure } from './loyaltyFailure';

it('keeps uncertain and authorization failures recoverable and recognizes explicit business rejection', () => {
  for (const [status, code] of [[0, 'REQUEST_TIMEOUT'], [403, 'PERMISSION_DENIED'], [401, 'UNAUTHENTICATED'], [503, 'STORE_UNAVAILABLE'], [409, 'IDEMPOTENCY_PENDING'], [409, 'IDEMPOTENCY_CONFLICT']] as const) {
    expect(isLoyaltySaveRejected(new ApiProblem(status, { code, message: 'synthetic', request_id: 'request-A' }))).toBe(false);
  }
  expect(isLoyaltySaveRejected(new ApiProblem(409, { code: 'CONFIG_VERSION_CONFLICT', message: 'synthetic', request_id: 'request-A' }))).toBe(true);
});

it('retains the request number and field location for a server validation failure', () => {
  const error = new ApiProblem(422, { code: 'RANGE_INVALID', message: '金额超出范围', request_id: 'request-A', details: { field: 'value.coupons[3].insurance_discount_fen' } });
  expect(loyaltyFailure(error)).toEqual({ message: '金额超出范围', requestId: 'request-A', field: 'value.coupons[3].insurance_discount_fen', configConflicts: [], configConflictError: null, fieldErrors: { 'value.coupons[3].insurance_discount_fen': '金额超出范围', 'coupons.3.insurance_discount_fen': '金额超出范围' } });
});

it('reads generated validation details and ends only explicit contract business rejection', () => {
  const error = new ApiProblem(422, { code: 'VALIDATION_FAILED', message: '配置字段错误', request_id: 'request-A', details: { errors: [{ field: 'prizes.4.total_qty', reason: '不能少于已发数量', rule: 'inventory' }] } });
  expect(loyaltyFailure(error).fieldErrors).toEqual({ 'prizes.4.total_qty': '不能少于已发数量' });
  for (const code of ['VERSION_CONFLICT', 'VALIDATION_FAILED', 'RESOURCE_CONFLICT']) expect(isLoyaltySaveRejected(new ApiProblem(409, { code, message: '配置拒绝', request_id: 'request-A' }))).toBe(true);
});
it.each([
  ['value.prizes[4].total_qty', 'prizes.4.total_qty'],
  ['value.prizes[4].probability_bps', 'prizes.4.probability_bps'],
  ['value.prizes[4].pink_reward_units', 'prizes.4.pink_reward_units'],
  ['value.prizes[4].enabled', 'prizes.4.enabled'],
  ['value.coupons[0].enabled', 'coupons.0.enabled'],
  ['value.enabled', 'enabled'],
  ['value.no_win_probability_bps', 'no_win_probability_bps'],
  ['value.cost_pink_units', 'cost_pink_units'],
])('locates %s at %s while retaining the original Problem identity', (field, control) => {
  const error = new ApiProblem(422, { code: 'VALIDATION_FAILED', message: '原服务端拒绝', request_id: 'original-request', details: { field, errors: [{ field, reason: '原字段原因' }] } });
  const result = loyaltyFailure(error); expect(result.field).toBe(field); expect(result.requestId).toBe('original-request'); expect(result.message).toBe('原服务端拒绝');
  expect(result.fieldErrors[field]).toBe('原服务端拒绝'); expect(result.fieldErrors[control]).toBe('原服务端拒绝'); expect(isLoyaltySaveRejected(error)).toBe(true);
});

const sourceConflict = { field: 'value.coupons[1].enabled', coupon_type: 'PUBLISH_ONCE', source_kind: 'PROGRESS', source_config_key: 'benefits.catalog', source_config_version_id: 'catalog-frozen' } as const;
it('uses only a strict server RESOURCE_CONFLICT detail and keeps original fields and request identity', () => {
  const result = loyaltyFailure(new ApiProblem(409, { code: 'RESOURCE_CONFLICT', message: '启用来源冲突', request_id: 'conflict-request', details: { resource_type: 'system_config', resource_id: 'benefits.coupons', config_conflicts: [sourceConflict] } }));
  expect(result.configConflicts).toEqual([sourceConflict]); expect(result.configConflictError).toBeNull();
  expect(result.requestId).toBe('conflict-request'); expect(result.fieldErrors).toEqual({ 'value.coupons[1].enabled': '启用来源冲突', 'coupons.1.enabled': '启用来源冲突' });
  for (const [status, code] of [[503, 'RESOURCE_CONFLICT'], [409, 'IDEMPOTENCY_PENDING'], [409, 'OTHER_CONFLICT']] as const) {
    expect(loyaltyFailure(new ApiProblem(status, { code, message: '结果未知', request_id: 'unknown-request', details: { config_conflicts: [sourceConflict] } })).configConflicts).toEqual([]);
  }
});
it.each([
  [], Array.from({ length: 17 }, () => sourceConflict), [{ ...sourceConflict, field: 'value.coupons[4].enabled' }],
  [{ ...sourceConflict, coupon_type: 'OLD_COUPON' }], [{ ...sourceConflict, source_kind: 'CATALOG' }],
  [{ ...sourceConflict, source_kind: 'CHECK_IN' }], [{ ...sourceConflict, source_config_version_id: '' }],
  [{ ...sourceConflict, source_config_version_id: ' ' }], [{ ...sourceConflict, source_config_version_id: 'x'.repeat(65) }],
  [{ ...sourceConflict, extra: true }], [null],
].map((config_conflicts) => ({ config_conflicts })))('fails closed for malformed configuration source details %j', ({ config_conflicts }) => {
  const result = loyaltyFailure(new ApiProblem(409, { code: 'RESOURCE_CONFLICT', message: '原服务端拒绝', request_id: 'original-request', details: { config_conflicts } }));
  expect(result.configConflicts).toEqual([]); expect(result.configConflictError).toContain('无法核对'); expect(result.requestId).toBe('original-request');
});
