import { expect, it, vi } from 'vitest';
import { createLoyaltyManagement, type LoyaltySaveRequest } from './loyaltyManagement';
import type { ApiClient } from '../api/client';
import { ApiProblem } from '../api/problem';

it('uses filtered effective and direct PUT with caller-owned original body and key', async () => {
  const request = vi.fn().mockResolvedValue({ current: null, inventory: null, as_of_at: '2026-10-01T00:00:00Z' });
  const gateway = createLoyaltyManagement({ request } as ApiClient); const signal = new AbortController().signal;
  await gateway.effective('benefits.coupons', signal);
  expect(request).toHaveBeenLastCalledWith({ path: '/v1/ops/system-config/effective?config_key=benefits.coupons', signal });
  const body: LoyaltySaveRequest = { base_effective_epoch: '9007199254740993', reason: '调整优惠券配置', value: { coupons: [] } };
  await gateway.save('benefits.coupons', body, 'original-key-12345678');
  await gateway.save('benefits.coupons', body, 'original-key-12345678');
  expect(request.mock.calls[1]).toEqual(request.mock.calls[2]);
  expect(request).toHaveBeenLastCalledWith({ path: '/v1/ops/system-config/effective/benefits.coupons', method: 'PUT', body, idempotencyKey: 'original-key-12345678' });
});
it('preserves null terminal cursors and NO_WIN null fields and encodes exact IDs', async () => {
  const page = { items: [{ state: 'COMPLETED', result_kind: 'NO_WIN', prize_code: null, coupon_id: null, pink_reward_entry_id: null }], page: { next_cursor: null }, as_of_at: '2026-10-01T00:00:00Z' };
  const request = vi.fn().mockResolvedValue(page); const gateway = createLoyaltyManagement({ request } as ApiClient);
  await expect(gateway.lotteryAttempts({ draw_id: 'draw/A', state: 'COMPLETED', result_kind: 'NO_WIN', cursor: 'next+1' })).resolves.toBe(page);
  expect(request).toHaveBeenLastCalledWith({ path: '/v1/ops/lottery-attempts?page_size=20&draw_id=draw%2FA&state=COMPLETED&result_kind=NO_WIN&cursor=next%2B1' });
  await gateway.detail('coupon', 'coupon/A'); expect(request).toHaveBeenLastCalledWith({ path: '/v1/ops/coupons/coupon%2FA' });
  await gateway.detail('operation-event', 'event/A'); expect(request).toHaveBeenLastCalledWith({ path: '/v1/ops/operation-events/event%2FA' });
});
it('propagates failed reads and uncertain writes without retry or manufactured values', async () => {
  const error = new ApiProblem(503, { code: 'DEPENDENCY_UNAVAILABLE', message: '读取暂不可用', request_id: 'read-A' });
  const request = vi.fn().mockRejectedValue(error); const gateway = createLoyaltyManagement({ request } as ApiClient);
  await expect(gateway.effective('benefits.lottery')).rejects.toBe(error);
  await expect(gateway.save('benefits.lottery', { base_effective_epoch: '1', value: { coupons: [] }, reason: '调整配置' }, 'original-123456789')).rejects.toBe(error);
  expect(request).toHaveBeenCalledTimes(2);
});
