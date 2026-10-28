import type { components } from '../../../types/api/schema';

export type ActionDecision = components['schemas']['ActionDecision'];
export type ActionDecisionCode = ActionDecision['decision'];

export function isActionPending(decision: ActionDecisionCode): boolean {
  return decision === 'WAITING' || decision === 'RECONCILING' || decision === 'COMPENSATING';
}

export function isActionTerminal(decision: ActionDecisionCode): boolean {
  return decision === 'ACCEPTED' || decision === 'IDEMPOTENT_REPLAY' || decision === 'REJECTED' || decision === 'STALE_NOOP';
}
