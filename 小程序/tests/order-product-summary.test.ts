import { afterEach, beforeEach, expect, test, vi } from 'vitest';

type Measured = { height?: number; 'line-height'?: string } | null;
type Instance = {
  data: Record<string, unknown>;
  setData(patch: Record<string, unknown>): void;
  triggerEvent: ReturnType<typeof vi.fn>;
  createSelectorQuery(): unknown;
  [key: string]: unknown;
};
type Method = (this: Instance) => void;
type Definition = {
  data: Record<string, unknown>;
  properties: Record<string, { value: unknown }>;
  methods: Record<string, Method>;
  lifetimes: Record<string, Method>;
  pageLifetimes: Record<string, Method>;
  observers: Record<string, Method>;
};
let definition: Definition;
let measurements: Array<(nodes: Measured[]) => void>;

beforeEach(async () => {
  vi.resetModules(); measurements = [];
  vi.stubGlobal('Component', (value: Definition) => { definition = value; });
  vi.stubGlobal('wx', { nextTick: (callback: () => void) => callback() });
  await import('../miniprogram/components/order-product-summary/index');
});
afterEach(() => vi.unstubAllGlobals());

function component(): Instance {
  const query = { select: () => query, fields: () => query, exec: (callback: (nodes: Measured[]) => void) => { measurements.push(callback); } };
  const instance: Instance = {
    ...definition.methods,
    data: { ...Object.fromEntries(Object.entries(definition.properties).map(([key, value]) => [key, value.value])), ...definition.data, variant: 'order-list', title: '当前订单设备的完整名称' },
    setData(patch) { Object.assign(this.data, patch); },
    triggerEvent: vi.fn(), createSelectorQuery: () => query,
  };
  definition.lifetimes['ready']!.call(instance);
  return instance;
}
const result = (height: number): Measured[] => [{ height, 'line-height': '24px' }];
function act(instance: Instance, name: string) { definition.methods[name]!.call(instance); }

test('a title that fits two lines has no unnecessary expansion action', () => {
  const instance = component(); measurements[0]!(result(48));
  expect(instance.data).toMatchObject({ titleOverflow: false, titleExpanded: false });
  act(instance, 'toggleTitle'); act(instance, 'open');
  expect(instance.data['titleExpanded']).toBe(false);
  expect(instance.triggerEvent).not.toHaveBeenCalled();
});

test('viewing and collapsing a long name never navigates; the product action stays separate', () => {
  const instance = component(); instance.data['clickable'] = true; measurements[0]!(result(96));
  expect(instance.data).toMatchObject({ titleOverflow: true, titleExpanded: false });
  act(instance, 'toggleTitle'); expect(instance.data['titleExpanded']).toBe(true);
  act(instance, 'toggleTitle'); expect(instance.data['titleExpanded']).toBe(false);
  expect(instance.triggerEvent).not.toHaveBeenCalled();
  act(instance, 'open'); expect(instance.triggerEvent).toHaveBeenCalledExactlyOnceWith('open');
});

test('a late measurement cannot override a newer viewport result', () => {
  const instance = component(); definition.pageLifetimes['resize']!.call(instance);
  measurements[1]!(result(24)); measurements[0]!(result(120));
  expect(instance.data).toMatchObject({ titleOverflow: false, titleExpanded: false });
});

test('changing the bound product clears expansion and rejects the previous title measurement', () => {
  const instance = component(); measurements[0]!(result(96)); act(instance, 'toggleTitle');
  definition.pageLifetimes['resize']!.call(instance);
  instance.data['title'] = '新设备'; definition.observers['title, variant']!.call(instance);
  measurements[1]!(result(96));
  expect(instance.data).toMatchObject({ titleOverflow: false, titleExpanded: false });
  measurements[2]!(result(24));
  expect(instance.data).toMatchObject({ titleOverflow: false, titleExpanded: false });
});

test('detached components reject pending measurements and expansion actions', () => {
  const instance = component(); definition.lifetimes['detached']!.call(instance);
  measurements[0]!(result(96)); act(instance, 'toggleTitle');
  expect(instance.data).toMatchObject({ titleOverflow: false, titleExpanded: false });
});

test('unavailable native geometry keeps the full name visible', () => {
  const instance = component(); measurements[0]!([null]);
  expect(instance.data).toMatchObject({ titleOverflow: false, titleExpanded: true });
});
