export interface DemoClockState {
  currentTime: string;
}

export function nextDemoTimestamp(state: DemoClockState, stepMs = 1_000): string {
  const current = new Date(state.currentTime);
  if (Number.isNaN(current.getTime())) {
    throw new Error('invalid deterministic demo clock state');
  }
  const result = current.toISOString();
  state.currentTime = new Date(current.getTime() + stepMs).toISOString();
  return result;
}

export function advanceDemoClock(state: DemoClockState, amountMs: number): string {
  const current = new Date(state.currentTime);
  if (Number.isNaN(current.getTime()) || !Number.isSafeInteger(amountMs) || amountMs < 0) {
    throw new Error('invalid deterministic demo clock advance');
  }
  state.currentTime = new Date(current.getTime() + amountMs).toISOString();
  return state.currentTime;
}
