import type { RentalReturn } from '../../shared/services/rentalOrders';

/** Synthetic read DTO used only by review component tests. */
export function returnEvidenceFixture(): Pick<RentalReturn, 'evidence_template' | 'evidence_slots' | 'evidence_history' | 'evidence_version' | 'cabinet_task' | 'missing_items' | 'pre_return_complete'> {
  const slot = { slot_key: 'front', title: '设备外观', kind: 'PHOTO' as const, stage: 'PRE_RETURN' as const, min_count: 1, max_count: 1, instruction: '拍清设备外观', sort_order: 1, example: null };
  return { evidence_template: { template_key: 'test', version: '1', title: '隔离模板', slots: [slot] }, evidence_slots: [{ slot, items: [], editable: false, complete: false, blocker: null }], evidence_history: [], evidence_version: '0', cabinet_task: null, missing_items: [], pre_return_complete: false };
}
