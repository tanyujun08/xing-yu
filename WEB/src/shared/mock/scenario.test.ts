import { beforeEach, describe, expect, it } from 'vitest';
import { MockBehaviorController } from './scenario';

describe('MockBehaviorController', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('consumes one-shot faults and leaves the next request healthy', async () => {
    const controller = new MockBehaviorController();
    controller.configure({ latencyMs: 0, fault: 'FORBIDDEN', faultMode: 'ONCE' });

    await expect(controller.execute('catalog.list', undefined, () => ['never']))
      .rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(controller.getSnapshot().fault).toBe('NONE');
    await expect(controller.execute('catalog.list', undefined, () => ['ready'])).resolves.toEqual(['ready']);
  });

  it('keeps persistent UNKNOWN faults until explicitly reset', async () => {
    const controller = new MockBehaviorController();
    controller.configure({ latencyMs: 0, fault: 'UNKNOWN', faultMode: 'PERSISTENT' });

    await expect(controller.execute('orders.pay', undefined, () => 'paid'))
      .rejects.toMatchObject({ code: 'UNKNOWN' });
    expect(controller.getSnapshot().fault).toBe('UNKNOWN');
    controller.reset();
    expect(controller.getSnapshot()).toMatchObject({ latencyMs: 0, fault: 'NONE', faultMode: 'ONCE' });
  });
});
