import { describe, expect, it } from 'vitest';
import { LoyaltySaveIntentStore } from './loyaltySaveIntent';

function fixture() {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  const valid = (value: unknown): value is { value: string } => typeof value === 'object' && value !== null && 'value' in value && typeof value.value === 'string';
  const create = () => new LoyaltySaveIntentStore(storage, valid, () => 'synthetic-original-intent');
  return { data, storage, valid, create };
}

describe('configuration save recovery', () => {
  it('restores the original body and key after reload without accepting later edits', () => {
    const { create } = fixture();
    const body = { value: 'original' };
    const first = create().begin('operator-A', 'configuration-A', body);
    body.value = 'modified';
    const restored = create().begin('operator-A', 'configuration-A', { value: 'new draft' });
    expect(restored).toEqual(first);
    expect(restored.body.value).toBe('original');
  });

  it('isolates operators and configuration keys and ignores completion of an older request', () => {
    const { create } = fixture(); const store = create();
    store.begin('operator-A', 'configuration-A', { value: 'A' });
    expect(store.read('operator-B', 'configuration-A')).toBeNull();
    expect(store.read('operator-A', 'configuration-B')).toBeNull();
    store.resolve('operator-A', 'configuration-A', 'different-intent');
    expect(store.read('operator-A', 'configuration-A')).not.toBeNull();
    store.resolve('operator-A', 'configuration-A', 'synthetic-original-intent');
    expect(store.read('operator-A', 'configuration-A')).toBeNull();
  });

  it('fails closed on corrupted recovery data instead of creating a replacement intent', () => {
    const { data, create } = fixture(); const store = create();
    store.begin('operator-A', 'configuration-A', { value: 'A' });
    const entry = [...data.keys()][0]!;
    data.set(entry, '{invalid');
    expect(() => store.begin('operator-A', 'configuration-A', { value: 'new' })).toThrow('原保存请求无法读取');
    expect(data.get(entry)).toBe('{invalid');
  });

  it('does not return a request when storage fails or loses its persisted body or key', () => {
    const { storage, valid } = fixture();
    const throwing = new LoyaltySaveIntentStore({ ...storage, setItem: () => { throw new Error('storage unavailable'); } }, valid);
    expect(() => throwing.begin('operator-A', 'configuration-A', { value: 'A' })).toThrow('storage unavailable');
    const dropped = new LoyaltySaveIntentStore({ ...storage, setItem: () => undefined }, valid);
    expect(() => dropped.begin('operator-A', 'configuration-A', { value: 'A' })).toThrow('未完整保全');
    for (const corruption of ['body', 'key'] as const) {
      const { storage: other, valid: guard } = fixture();
      const changed = new LoyaltySaveIntentStore({ ...other, setItem: (key, raw) => {
        const parsed = JSON.parse(raw);
        if (corruption === 'body') parsed.body = { value: 'changed' };
        else parsed.key = 'synthetic-changed-intent';
        other.setItem(key, JSON.stringify(parsed));
      } }, guard);
      expect(() => changed.begin('operator-A', 'configuration-A', { value: 'A' })).toThrow('未完整保全');
    }
  });

  it('checks removal and keeps a new intent when an earlier terminal result arrives late', () => {
    const { storage, valid, create } = fixture();
    const first = create().begin('operator-A', 'configuration-A', { value: 'A' });
    create().resolve('operator-A', 'configuration-A', first.key);
    const next = new LoyaltySaveIntentStore(storage, valid, () => 'synthetic-next-intent');
    next.begin('operator-A', 'configuration-A', { value: 'B' });
    create().resolve('operator-A', 'configuration-A', first.key);
    expect(next.read('operator-A', 'configuration-A')).toEqual({ key: 'synthetic-next-intent', body: { value: 'B' } });
    const retained = new LoyaltySaveIntentStore({ ...storage, removeItem: () => undefined }, valid);
    expect(() => retained.resolve('operator-A', 'configuration-A', 'synthetic-next-intent')).toThrow('清理未确认');
    expect(next.read('operator-A', 'configuration-A')?.body).toEqual({ value: 'B' });
  });
});
