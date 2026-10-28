import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

type Harness = {
  data: { tabs: Array<{ id: string; label: string; disabled?: boolean }>; value: string };
  triggerEvent: ReturnType<typeof vi.fn>;
};
let definition: {
  properties: { divider: { value: boolean } };
  methods: { onSelect(this: Harness, event: { currentTarget: { dataset: { value: string } } }): void };
};
beforeAll(async () => {
  vi.stubGlobal('Component', (options: typeof definition) => { definition = options; });
  await import('../miniprogram/components/section-tabs/index');
});
afterAll(() => vi.unstubAllGlobals());

describe('section-tabs', () => {
  test('emits change without mutating controlled value', () => {
    const harness: Harness = { data: { tabs: [{ id: 'a', label: '全部' }, { id: 'b', label: '待结算' }], value: 'a' }, triggerEvent: vi.fn() };
    definition.methods.onSelect.call(harness, { currentTarget: { dataset: { value: 'b' } } });
    expect(harness.triggerEvent).toHaveBeenCalledWith('change', { value: 'b' });
    expect(harness.data.value).toBe('a');
  });
  test.each(['a', 'disabled', 'missing'])('ignores invalid selection: %s', (value) => {
    const harness: Harness = { data: { tabs: [{ id: 'a', label: '全部' }, { id: 'disabled', label: '不可用', disabled: true }], value: 'a' }, triggerEvent: vi.fn() };
    definition.methods.onSelect.call(harness, { currentTarget: { dataset: { value } } });
    expect(harness.triggerEvent).not.toHaveBeenCalled();
  });
  test('divider is optional; only divider mode reserves underline space', () => {
    expect(definition.properties.divider.value).toBe(false);
    const css = readFileSync('miniprogram/components/section-tabs/index.wxss', 'utf8');
    expect(css).toContain('.section-tabs__content { margin-top: var(--xy-layout-content-gap); }');
    expect(css).toContain('.section-tabs--divider .section-tabs__rail { padding-bottom: var(--xy-space-2); }');
    expect(css).toContain('bottom: calc(-1 * var(--xy-space-2))');
    expect(css.match(/\.section-tabs__rail \{([^}]+)\}/)?.[1]).not.toContain('padding');
  });
});
