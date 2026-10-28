export interface WithdrawalDisplayRecord {
  id: string;
  amountText: string;
  amountValueText?: string;
  failureText?: string;
  state: string;
  stateText: string;
  stateTone: string;
  accountLabel: string;
  createdText: string;
  progressTimeText?: string;
}

// Temporary visual-review switch for XY-20260906-002; never feeds the ledger.
export const WITHDRAWAL_REFERENCE_PREVIEW = true;

export function useWithdrawalReferencePreview(stage: string, platform: string): boolean {
  return WITHDRAWAL_REFERENCE_PREVIEW && stage === 'develop' && platform === 'devtools';
}

export function partitionWithdrawalRecords(records: WithdrawalDisplayRecord[]) {
  const sorted = [...records].sort((a, b) => b.createdText.localeCompare(a.createdText));
  const currentWithdrawal = sorted.find((record) => ['processing', 'confirming', 'unknown'].includes(record.state)) ?? null;
  return { currentWithdrawal: currentWithdrawal ? { ...currentWithdrawal, progressTimeText: currentWithdrawal.createdText.slice(5) } : null, historyWithdrawals: sorted.filter((record) => record !== currentWithdrawal) };
}
