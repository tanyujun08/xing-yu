import { createOperationScope } from './operation-scope';

const scopes = new WeakMap<object, ReturnType<typeof createOperationScope>>();
function scopeFor(owner: object) {
  let scope = scopes.get(owner);
  if (!scope) { scope = createOperationScope(); scopes.set(owner, scope); }
  return scope;
}
export function viewDisposed(owner: object): boolean { return scopeFor(owner).disposed; }
export function disposeView(owner: object): void { scopeFor(owner).dispose(); }
/** Capture the caller's account/object/state identity before a host callback. */
export function captureViewGuard(owner: object, readIdentity: () => string): () => boolean {
  const scope = scopeFor(owner);
  const identity = readIdentity();
  return () => !scope.disposed && Boolean(identity) && readIdentity() === identity;
}
