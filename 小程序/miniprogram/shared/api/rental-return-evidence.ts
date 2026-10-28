import { demoStorage } from '../../preview/storage';
import { rentalOrderApi, type RentalReturn, type RentalRecord } from './rental-order-api';
import { readStoredApiSession } from '../session/api-session';
import { runMaterialUpload } from './material-upload';
import { createMaterialUploadIntent, type MaterialUploadIntent } from '../model/material-media';
import { newIdempotencyKey } from './idempotency';
import type { OperationScope } from '../interaction/operation-scope';
import { ApiProblem } from './problem';

export type RentalEvidenceDraft = { slotKey: string; itemNo: number; reason: string | null; intent: MaterialUploadIntent };
function owner() { const id = readStoredApiSession()?.accountId; if (!id) throw new Error('请先登录'); return id; }
function storage(orderId: string) { return 'xingyu.return-slots.v2:' + owner() + ':' + orderId; }
function assertDrafts(value: unknown, account: string): asserts value is RentalEvidenceDraft[] {
  if (!Array.isArray(value) || value.length > 20 || value.some(v => !v || !/^[a-z][a-z0-9-]{0,63}$/.test(v.slotKey) || !Number.isInteger(v.itemNo) || v.itemNo < 1 || v.itemNo > 20 || !v.intent || v.intent.owner !== account || !v.intent.key || !v.intent.file || !['EVIDENCE_IMAGE', 'EVIDENCE_VIDEO'].includes(v.intent.materialClass))) throw new Error('归还凭证草稿不可读取');
  if (new Set(value.map(v => v.slotKey + ':' + v.itemNo)).size !== value.length) throw new Error('归还槽位草稿重复');
}
export const rentalEvidenceDrafts = {
  read(orderId: string): RentalEvidenceDraft[] {
    const value: unknown = demoStorage.getStorageSync(storage(orderId)) || [];
    assertDrafts(value, owner());
    return value.map(v => ({ ...v, intent: { ...v.intent, phase: v.intent.phase === 'FAILED' ? 'FAILED' : v.intent.materialId ? 'PROCESSING' : v.intent.phase === 'SELECTED' ? 'SELECTED' : 'UNKNOWN' } }));
  },
  save(orderId: string, values: RentalEvidenceDraft[]) { assertDrafts(values, owner()); demoStorage.setStorageSync(storage(orderId), values); },
  replaceFailed(orderId: string, values: RentalEvidenceDraft[], key: string): RentalEvidenceDraft[] {
    const draft = values.find(v => v.slotKey + ':' + v.itemNo === key);
    if (draft && (draft.intent.phase !== 'FAILED' || rentalOrderApi.pendingReturnEvidence(orderId, draft.slotKey, draft.itemNo))) throw new Error('原请求结果待核实，请先恢复原请求');
    return values.filter(v => v !== draft);
  },
  create(slotKey: string, itemNo: number, file: string, kind: string, reason: string | null): RentalEvidenceDraft {
    return { slotKey, itemNo, reason, intent: createMaterialUploadIntent({ owner: owner(), field: slotKey, item: String(itemNo), file, generation: Date.now(), key: newIdempotencyKey('return-proof'), materialClass: kind === 'VIDEO' ? 'EVIDENCE_VIDEO' : 'EVIDENCE_IMAGE' }) };
  },
};

/** The selected file and the binding intent survive page hide and unknown responses. */
export async function saveRentalEvidenceDraft(orderId: string, draft: RentalEvidenceDraft, options: { scope: OperationScope; active: () => boolean; recovery: boolean; changed: () => void }): Promise<RentalRecord<RentalReturn> | null> {
  const active = () => options.active() && readStoredApiSession()?.accountId === draft.intent.owner;
  if (!active()) return null;
  if (rentalOrderApi.pendingReturnEvidence(orderId, draft.slotKey, draft.itemNo)) {
    if (!options.recovery) throw new Error('原凭证保存结果待核实，请恢复原请求');
    const recovered = await rentalOrderApi.recoverReturnEvidence(orderId, draft.slotKey, draft.itemNo).promise;
    return active() ? recovered : null;
  }
  if (draft.intent.phase !== 'READY') await runMaterialUpload(draft.intent, { scope: options.scope, isCurrent: active, explicitRecovery: options.recovery, onState: options.changed }).promise;
  if (!active()) return null;
  const current = await rentalOrderApi.return(orderId).promise;
  if (!active()) return null;
  const bound = current.value.evidence_history.find(v => v.material_id === draft.intent.materialId && v.slot_key === draft.slotKey && v.item_no === draft.itemNo);
  if (bound) return current;
  if (!draft.intent.materialId) throw new Error('凭证素材尚未就绪');
  try {
    const result = await rentalOrderApi.saveReturnEvidence(orderId, draft.slotKey, draft.itemNo, { material_id: draft.intent.materialId, reason: draft.reason }, current.etag).promise;
    return active() ? result : null;
  } catch (error) {
    if (active() && error instanceof ApiProblem && [409, 422].includes(error.statusCode) && !rentalOrderApi.pendingReturnEvidence(orderId, draft.slotKey, draft.itemNo)) {
      draft.intent.phase = 'FAILED'; draft.intent.error = error.message; options.changed();
    }
    throw error;
  }
}
