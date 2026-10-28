import { createOperationScope } from './operation-scope';
const runtimes = new WeakMap<object, { scope: ReturnType<typeof createOperationScope>; timer?: ReturnType<typeof setTimeout> }>();
function runtime(owner: object) {
  let value = runtimes.get(owner);
  if (!value) { value = { scope: createOperationScope() }; runtimes.set(owner, value); }
  return value;
}
export function dayPageDisposed(owner: object) { return runtime(owner).scope.disposed; }
export function stopDayRefresh(owner: object) {
  const value = runtime(owner);
  if (value.timer !== undefined) value.scope.clearTimer(value.timer);
  delete value.timer;
}
export function watchDayRefresh(owner: object, refresh: () => void) {
  stopDayRefresh(owner);
  const value = runtime(owner);
  if (value.scope.disposed) return;
  const next = new Date(); next.setHours(24, 0, 0, 0);
  value.timer = value.scope.setTimeout(refresh, Math.max(1, next.getTime() - Date.now()));
}
export function disposeDayRefresh(owner: object) { runtime(owner).scope.dispose(); }
