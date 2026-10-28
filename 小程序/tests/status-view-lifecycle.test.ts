import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

interface ComponentDefinition {
  data: Record<string, unknown>;
  properties: Record<string, { value: unknown }>;
  lifetimes: { attached(): void; detached(): void };
  methods: Record<string, (...args: unknown[]) => unknown>;
}

interface ComponentHarness {
  data: Record<string, unknown>;
  setData(patch: Record<string, unknown>): void;
  syncView(): void;
}

let definition: ComponentDefinition;
let previousComponent: typeof Component | undefined;

function makeHarness(state: string): ComponentHarness {
  const data = {
    ...structuredClone(definition.data),
    ...Object.fromEntries(Object.entries(definition.properties).map(([key, descriptor]) => [key, descriptor.value])),
    state,
  };
  const harness = {
    data,
    setData(this: ComponentHarness, patch: Record<string, unknown>) { Object.assign(this.data, patch); },
  } as unknown as ComponentHarness;
  for (const [name, method] of Object.entries(definition.methods)) {
    (harness as unknown as Record<string, unknown>)[name] = method.bind(harness);
  }
  return harness;
}

beforeAll(async () => {
  const globalWithComponent = globalThis as typeof globalThis & { Component?: typeof Component };
  previousComponent = globalWithComponent.Component;
  globalWithComponent.Component = ((options: object) => { definition = options as ComponentDefinition; }) as typeof Component;
  await import('../miniprogram/components/status-view/index');
});

afterAll(() => {
  const globalWithComponent = globalThis as typeof globalThis & { Component?: typeof Component };
  if (previousComponent) globalWithComponent.Component = previousComponent;
  else delete globalWithComponent.Component;
});

afterEach(() => { vi.useRealTimers(); });

describe('status-view loading visibility', () => {
  test('does not flash for a loading state shorter than 100ms', () => {
    vi.useFakeTimers();
    const component = makeHarness('loading');
    definition.lifetimes.attached.call(component);
    vi.advanceTimersByTime(99);
    component.data.state = 'empty';
    component.syncView();
    vi.runAllTimers();
    expect(component.data.spinnerVisible).toBe(false);
    definition.lifetimes.detached.call(component);
  });

  test('shows at 100ms and remains visible for 200ms once shown', () => {
    vi.useFakeTimers();
    const component = makeHarness('loading');
    definition.lifetimes.attached.call(component);
    vi.advanceTimersByTime(99);
    expect(component.data.spinnerVisible).toBe(false);
    vi.advanceTimersByTime(1);
    expect(component.data.spinnerVisible).toBe(true);

    component.data.state = 'empty';
    component.syncView();
    vi.advanceTimersByTime(199);
    expect(component.data.spinnerVisible).toBe(true);
    vi.advanceTimersByTime(1);
    expect(component.data.spinnerVisible).toBe(false);
    definition.lifetimes.detached.call(component);
  });
});
