import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { readCurrentSessionProjection } from '../access/session';
import type { DemoRuntime } from '../mock';
import {
  MockBehaviorController,
} from '../mock/scenario';
import { MockScenarioContext, type MockScenarioContextValue } from './mockScenarioContextValue';

interface MockScenarioProviderProps {
  children: ReactNode;
  runtime: DemoRuntime;
  behaviorController: MockBehaviorController;
}

export function MockScenarioProvider({ children, runtime, behaviorController }: MockScenarioProviderProps) {
  const behavior = useSyncExternalStore(
    behaviorController.subscribe,
    behaviorController.getSnapshot,
    behaviorController.getSnapshot,
  );
  const [runtimeInfo, setRuntimeInfo] = useState(() => runtime.getInfo());
  useEffect(() => runtime.subscribe(() => setRuntimeInfo(runtime.getInfo())), [runtime]);

  const value = useMemo<MockScenarioContextValue>(() => ({
    behavior,
    runtimeInfo,
    configureBehavior: (input) => {
      const actorId = readCurrentSessionProjection().accountId ?? 'mock-anonymous';
      runtime.recordMockControl('MOCK_BEHAVIOR_CONFIGURED', actorId, input);
      behaviorController.configure(input);
    },
    resetBehavior: () => {
      const actorId = readCurrentSessionProjection().accountId ?? 'mock-anonymous';
      runtime.recordMockControl('MOCK_BEHAVIOR_CONFIGURED', actorId, {
        latencyMs: 0,
        fault: 'NONE',
        faultMode: 'ONCE',
      });
      behaviorController.reset();
    },
    resetScenario: (scenarioName) => {
      const result = runtime.resetScenario(
        scenarioName,
        readCurrentSessionProjection().accountId ?? 'mock-anonymous',
      );
      behaviorController.reset();
      return result;
    },
    advanceClock: (amountMs) => runtime.advanceClock(amountMs, readCurrentSessionProjection().accountId ?? 'mock-anonymous'),
  }), [behavior, behaviorController, runtime, runtimeInfo]);

  return <MockScenarioContext.Provider value={value}>{children}</MockScenarioContext.Provider>;
}
