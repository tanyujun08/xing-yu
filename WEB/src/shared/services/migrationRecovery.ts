export type RecoverableDemoBackupVersion = 'v6' | 'v7' | 'v9';

interface DemoRecoveryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function resolveRecoverableDemoBackupVersion(
  migrationKind: string | null,
): RecoverableDemoBackupVersion | null {
  if (migrationKind?.startsWith('SCHEMA_V6_') === true) return 'v6';
  if (migrationKind?.startsWith('SCHEMA_V7_') === true) return 'v7';
  if (migrationKind?.startsWith('SCHEMA_V9_') === true) return 'v9';
  return null;
}

export function preserveDemoBytesBeforeReset(
  storage: DemoRecoveryStorage,
  storageKey: string,
  backupVersion: RecoverableDemoBackupVersion,
  expectedRawBytes: string,
): void {
  const raw = storage.getItem(storageKey);
  if (raw === null) throw new Error('迁移阻断时的原始数据已不存在，已拒绝重置');
  if (raw !== expectedRawBytes) throw new Error('迁移阻断后的原始数据已变化，已拒绝重置');
  const backupKey = `${storageKey}.backup.${backupVersion}`;
  const existing = storage.getItem(backupKey);
  if (existing !== null && existing !== raw) {
    throw new Error(`${backupVersion} 备份已存在且与当前数据不一致`);
  }
  if (existing === null) storage.setItem(backupKey, raw);
  if (storage.getItem(backupKey) !== raw) throw new Error(`${backupVersion} 备份核对失败`);
}
