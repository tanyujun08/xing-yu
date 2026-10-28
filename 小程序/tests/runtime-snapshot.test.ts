import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = join(process.cwd(), 'miniprogram');
const source = (path: string): string => readFileSync(join(root, path), 'utf8');

describe('Order runtime boundary', () => {
  test('keeps unavailable order pages free of automatic runtime advancement', () => {
    for (const name of ['wechat-waiver']) {
      const script = source('pages/' + name + '/index.ts');
      expect(script).toContain('unavailableOrderPage');
      expect(script).not.toMatch(/mockApi|rentalApi|setTimeout|setInterval|advanceOrderRuntime|advanceCabinetRuntime/);
    }
  });

  test('refresh does not infer payment, cabinet or waiver completion', () => {
    const shared = source('shared/interaction/order-unavailable.ts');
    expect(shared).toContain('refresh: blockOrderAction');
    expect(shared).toContain('refreshStatus: blockOrderAction');
    expect(shared).not.toMatch(/wx\.request|requestPayment|scanCode|setStorageSync/);
    for (const name of ['order-detail', 'cabinet-return', 'wechat-waiver']) {
      expect(source('pages/' + name + '/index.ts')).not.toMatch(/status: ['"](?:success|completed|cabinet_closed|detecting)['"]/);
    }
  });

  test('preserves cabinet templates without development progress controls', () => {
    for (const name of ['order-detail', 'cabinet-return']) {
      expect(source('pages/' + name + '/index.wxml')).not.toContain('模拟处理下一步');
      expect(source('pages/' + name + '/index.ts')).not.toContain('advanceCabinetRuntime');
    }
  });
});
