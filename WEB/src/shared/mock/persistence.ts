import { DemoError } from '../demo';
import { DEFAULT_DEMO_STORAGE_KEY, normalizePersistedMockState, type MockState } from './schema';

export interface DemoStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DemoPersistence {
  load(): MockState | null;
  save(state: MockState): void;
  clear(): void;
}

export function createMemoryDemoStorage(): DemoStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function resolveBrowserStorage(): DemoStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function persistenceFailure(operation: '读取' | '写入' | '清除', error: unknown): DemoError {
  return new DemoError('PERSISTENCE_INVALID', `Mock 数据${operation}失败`, {
    cause: error instanceof Error ? error.message : 'UNKNOWN',
  });
}

function persistedStateBlocked(
  message: string,
  migrationKind: string,
  error?: unknown,
): DemoError {
  return new DemoError('PERSISTENCE_INVALID', message, {
    migrationBlocked: true,
    migrationKind,
    ...(error === undefined
      ? {}
      : {
          cause: error instanceof Error ? error.message : 'UNKNOWN',
          ...(error instanceof DemoError ? { causeCode: error.code } : {}),
        }),
  });
}

export function createDemoPersistence(
  storage: DemoStorage | null = resolveBrowserStorage(),
  storageKey = DEFAULT_DEMO_STORAGE_KEY,
): DemoPersistence {
  return {
    load(): MockState | null {
      if (storage === null) {
        return null;
      }
      let serialized: string | null;
      try {
        serialized = storage.getItem(storageKey);
      } catch (error) {
        throw persistenceFailure('读取', error);
      }
      if (serialized === null) {
        return null;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(serialized) as unknown;
      } catch (error) {
        throw persistedStateBlocked(
          'Mock 数据无法解析，原始本地数据已保留',
          'STORAGE_PARSE_FAILED',
          error,
        );
      }
      let normalized: MockState | null;
      try {
        normalized = normalizePersistedMockState(parsed);
      } catch (error) {
        if (
          error instanceof DemoError &&
          error.code === 'PERSISTENCE_INVALID' &&
          error.details.migrationBlocked === true
        ) {
          throw error;
        }
        throw persistedStateBlocked(
          'Mock 数据不满足持久化不变量，原始本地数据已保留',
          'PERSISTED_INVARIANT_FAILED',
          error,
        );
      }
      if (normalized === null) {
        throw persistedStateBlocked(
          'Mock 数据版本或结构无法安全识别，原始本地数据已保留',
          'STORAGE_SHAPE_UNSUPPORTED',
        );
      }
      if (normalized !== parsed) {
        try {
          const sourceSchemaVersion = typeof parsed === 'object' && parsed !== null && 'meta' in parsed
            && typeof (parsed as { meta?: unknown }).meta === 'object' && (parsed as { meta?: unknown }).meta !== null
            && 'schemaVersion' in ((parsed as { meta: object }).meta)
            ? Number(((parsed as { meta: { schemaVersion?: unknown } }).meta).schemaVersion)
            : Number.NaN;
          if (Number.isSafeInteger(sourceSchemaVersion) && sourceSchemaVersion < normalized.meta.schemaVersion) {
            const backupKey = `${storageKey}.backup.v${sourceSchemaVersion}`;
            const existingBackup = storage.getItem(backupKey);
            if (existingBackup !== null && existingBackup !== serialized) {
              throw persistedStateBlocked(
                `Mock v${sourceSchemaVersion} 原始备份与当前数据不一致，已拒绝覆盖和迁移`,
                'STORAGE_BACKUP_CONFLICT',
              );
            }
            if (existingBackup === null) storage.setItem(backupKey, serialized);
            if (storage.getItem(backupKey) !== serialized) {
              throw persistedStateBlocked('Mock 原始备份核对失败，主数据保持不变', 'STORAGE_BACKUP_VERIFY_FAILED');
            }
          }
          storage.setItem(storageKey, JSON.stringify(normalized));
        } catch (error) {
          if (error instanceof DemoError) throw error;
          throw persistenceFailure('写入', error);
        }
      }
      return structuredClone(normalized);
    },
    save(state: MockState): void {
      if (storage !== null) {
        try {
          storage.setItem(storageKey, JSON.stringify(state));
        } catch (error) {
          throw persistenceFailure('写入', error);
        }
      }
    },
    clear(): void {
      if (storage !== null) {
        try {
          storage.removeItem(storageKey);
        } catch (error) {
          throw persistenceFailure('清除', error);
        }
      }
    },
  };
}
