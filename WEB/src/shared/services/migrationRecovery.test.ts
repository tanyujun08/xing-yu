import { describe, expect, test } from 'vitest';
import { createMemoryDemoStorage } from '../mock';
import {
  preserveDemoBytesBeforeReset,
  resolveRecoverableDemoBackupVersion,
} from './migrationRecovery';

describe('migration recovery', () => {
  test('only maps explicitly recoverable schema migrations to their exact backup version', () => {
    expect(resolveRecoverableDemoBackupVersion('SCHEMA_V6_SHAPE_INVALID')).toBe('v6');
    expect(resolveRecoverableDemoBackupVersion('SCHEMA_V7_PRODUCT_KEY_CONFLICT')).toBe('v7');
    expect(resolveRecoverableDemoBackupVersion('SCHEMA_V9_TERMINAL_EVIDENCE_INCOMPLETE')).toBe('v9');
    expect(resolveRecoverableDemoBackupVersion('SCHEMA_V9_CANCEL_EVIDENCE_INCOMPLETE')).toBe('v9');
    expect(resolveRecoverableDemoBackupVersion('SCHEMA_V8_UNKNOWN')).toBeNull();
    expect(resolveRecoverableDemoBackupVersion('MERCHANT_SITE_COUNT')).toBeNull();
  });

  test('preserves v9 source bytes under backup.v9 and refuses a conflicting backup', () => {
    const storage = createMemoryDemoStorage();
    const storageKey = 'xingyu.admin.mock-demo.v1';
    const raw = '{"meta":{"schemaVersion":9}}';
    storage.setItem(storageKey, raw);

    preserveDemoBytesBeforeReset(storage, storageKey, 'v9', raw);
    expect(storage.getItem(`${storageKey}.backup.v9`)).toBe(raw);
    expect(storage.getItem(storageKey)).toBe(raw);

    storage.setItem(`${storageKey}.backup.v9`, 'different-bytes');
    expect(() => preserveDemoBytesBeforeReset(storage, storageKey, 'v9', raw)).toThrow(
      'v9 备份已存在且与当前数据不一致',
    );
    expect(storage.getItem(storageKey)).toBe(raw);
  });

  test('binds reset authorization to the exact bytes that caused the migration block', () => {
    const storage = createMemoryDemoStorage();
    const storageKey = 'xingyu.admin.mock-demo.v1';
    const blockedBytes = '{"meta":{"schemaVersion":9},"revision":1}';

    expect(() => preserveDemoBytesBeforeReset(storage, storageKey, 'v9', blockedBytes)).toThrow(
      '迁移阻断时的原始数据已不存在，已拒绝重置',
    );
    storage.setItem(storageKey, '{"meta":{"schemaVersion":9},"revision":2}');
    expect(() => preserveDemoBytesBeforeReset(storage, storageKey, 'v9', blockedBytes)).toThrow(
      '迁移阻断后的原始数据已变化，已拒绝重置',
    );
    expect(storage.getItem(`${storageKey}.backup.v9`)).toBeNull();
  });
});
