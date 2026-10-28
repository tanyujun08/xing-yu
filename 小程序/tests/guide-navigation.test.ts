import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';

interface Harness { data: Record<string, unknown>; setData(patch: Record<string, unknown>): void; [key: string]: unknown }
const definitions: Record<string, Harness> = {};
let loading = '';
const navigateTo = vi.fn();
beforeAll(async () => {
  vi.stubGlobal('Page', (value: Harness) => { definitions[loading] = value; });
  vi.stubGlobal('wx', { navigateTo });
  loading = 'profile'; await import('../miniprogram/pages/profile/index');
  loading = 'about'; await import('../miniprogram/pages/about/index');
  loading = 'guide'; await import('../miniprogram/pages/info-guide/index');
});
beforeEach(() => navigateTo.mockReset());
afterAll(() => vi.unstubAllGlobals());
function page(name: string): Harness {
  const definition = definitions[name]!;
  return { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } };
}
function call(target: Harness, name: string, ...args: unknown[]) { return (target[name] as (...values: unknown[]) => unknown).apply(target, args); }
test('guest can open guides and about while private profile entries retain login guard', () => {
  const target = page('profile');
  const guard = vi.fn(() => false);
  target.requireLogin = guard;
  for (const route of ['/pages/info-guide/index', '/pages/about/index']) {
    call(target, 'openItem', { currentTarget: { dataset: { route } } });
    expect(navigateTo).toHaveBeenLastCalledWith({ url: route, success: expect.any(Function), fail: expect.any(Function), complete: expect.any(Function) });
    const callbacks = navigateTo.mock.calls[navigateTo.mock.calls.length - 1]![0] as { complete: () => void };
    callbacks.complete();
  }
  expect(guard).not.toHaveBeenCalled();
  call(target, 'openItem', { currentTarget: { dataset: { route: '/pages/addresses/index' } } });
  expect(guard).toHaveBeenCalledOnce();
  expect(navigateTo).toHaveBeenCalledTimes(2);
});
test('profile header turns white on scroll and restores only at the top', () => {
  const target = page('profile');
  const update = vi.spyOn(target, 'setData');
  call(target, 'onPageScroll', { scrollTop: 1 });
  expect(target.data.headerScrolled).toBe(true);
  call(target, 'onPageScroll', { scrollTop: 100 });
  expect(update).toHaveBeenCalledTimes(1);
  call(target, 'onPageScroll', { scrollTop: 0 });
  expect(target.data.headerScrolled).toBe(false);
  call(target, 'onPageScroll', { scrollTop: -10 });
  expect(update).toHaveBeenCalledTimes(2);
});
test('guide directory contains only the three approved public topics, without policies or retired notices', () => {
  const target = page('guide');
  call(target, 'onLoad', {});
  expect(target.data.directory).toBe(true);
  expect((target.data.entries as { id: string }[]).map((row) => row.id)).toEqual(['rental-flow', 'deposit-waiver', 'device-protection']);
  call(target, 'openEntry', { currentTarget: { dataset: { id: 'service' } } });
  expect(navigateTo).not.toHaveBeenCalled();
});
test('about policies navigate to the original documents and reject unrelated IDs', () => {
  const target = page('about');
  for (const id of ['user-agreement', 'privacy-policy']) {
    call(target, 'openPolicy', { currentTarget: { dataset: { id } } });
    expect(navigateTo).toHaveBeenLastCalledWith({ url: '/pages/info-guide/index?id=' + id });
    const reader = page('guide');
    call(reader, 'onLoad', { id });
    expect(reader.data.directory).toBe(false);
    expect(reader.data.guide).toMatchObject({ id });
  }
  call(target, 'openPolicy', { currentTarget: { dataset: { id: 'service' } } });
  expect(navigateTo).toHaveBeenCalledTimes(2);
});
