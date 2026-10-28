export interface DemoIdState {
  nextId: number;
}

export function nextDemoId(state: DemoIdState, namespace: string): string {
  const normalized = namespace.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const id = `${normalized || 'record'}_${state.nextId.toString().padStart(6, '0')}`;
  state.nextId += 1;
  return id;
}
