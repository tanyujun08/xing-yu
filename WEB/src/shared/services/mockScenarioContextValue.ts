import { createContext, useContext } from 'react';
import type { MockBehaviorSnapshot } from '../mock/scenario';
import type { DemoRuntimeInfo, DemoScenarioName } from './contracts';

export interface MockScenarioContextValue {
  behavior: MockBehaviorSnapshot;
  runtimeInfo: DemoRuntimeInfo;
  configureBehavior(input: Pick<MockBehaviorSnapshot, 'latencyMs' | 'fault' | 'faultMode'>): void;
  resetBehavior(): void;
  resetScenario(scenarioName: DemoScenarioName): DemoRuntimeInfo;
  advanceClock(amountMs: number): DemoRuntimeInfo;
}

export const MockScenarioContext = createContext<MockScenarioContextValue | null>(null);

export function useMockScenario(): MockScenarioContextValue {
  const value = useContext(MockScenarioContext);
  if (value === null) throw new Error('useMockScenario must be used inside MockScenarioProvider');
  return value;
}
