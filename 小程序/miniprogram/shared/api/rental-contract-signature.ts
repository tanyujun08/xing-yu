import { demoStorage } from '../../preview/storage';
import { rentalOrderApi, type RentalContract, type RentalRecord, type RentalSignature, type RentalSignatureCreate } from './rental-order-api';
import { newIdempotencyKey } from './idempotency';
import { readStoredApiSession } from '../session/api-session';
import { createMaterialUploadIntent, type MaterialUploadIntent } from '../model/material-media';
import { runMaterialUpload } from './material-upload';
import type { OperationScope } from '../interaction/operation-scope';
import { ApiProblem } from './problem';
export { downloadPublicDocument as downloadRentalContract } from './request';

export interface SignatureUploadDraft {
    owner: string;
    orderId: string;
    contractETag: string;
    create: RentalSignatureCreate;
    upload: MaterialUploadIntent;
    failure: string | null;
}
const agreements = new Map<string, string>();
const owner = () => { const id = readStoredApiSession()?.accountId; if (!id) throw new Error('请先登录'); return id; };
const slot = (account: string, id: string) => 'xingyu.signature-upload.v1:' + encodeURIComponent(account) + ':' + encodeURIComponent(id);
const terms = (v: RentalContract) => v.agreement_sha256 + ':' + v.order_terms_sha256;
function save(draft: SignatureUploadDraft) { demoStorage.setStorageSync(slot(draft.owner, draft.orderId), draft); }
function removeLocalFile(path: string) { wx.getFileSystemManager().removeSavedFile({ filePath: path, fail: () => undefined }); }

/** Uploaded PNG recovery is owner/order bound; handwriting strokes stay in page memory. */
export const rentalSignatureDrafts = {
    agree(id: string, contract: RentalContract) { agreements.set(slot(owner(), id), terms(contract)); },
    hasAgreement(id: string, contract: RentalContract) { return agreements.get(slot(owner(), id)) === terms(contract); },
    read(id: string): SignatureUploadDraft | null {
        const account = owner(), value: unknown = demoStorage.getStorageSync(slot(account, id));
        if (!value) return null;
        const d = value as SignatureUploadDraft;
        if (d.owner !== account || d.orderId !== id || !d.contractETag || !d.create || !/^[!-~]{16,64}$/.test(d.create.client_signature_id) || !d.upload || d.upload.owner !== account || d.upload.materialClass !== 'CONTRACT_SIGNATURE_IMAGE' || !d.upload.file || !d.upload.key || !/^[a-f0-9]{64}$/.test(d.create.agreement_sha256) || !/^[a-f0-9]{64}$/.test(d.create.order_terms_sha256)) throw new Error('原签名上传记录不完整，请联系客服核实');
        return { ...d, create: { ...d.create }, upload: { ...d.upload, phase: d.upload.phase === 'FAILED' ? 'FAILED' : d.upload.materialId ? 'PROCESSING' : d.upload.phase === 'SELECTED' ? 'SELECTED' : 'UNKNOWN' } };
    },
    async create(id: string, file: string, record: RentalRecord<RentalContract>, active: () => boolean): Promise<SignatureUploadDraft> {
        const account = owner();
        if (this.read(id) || rentalOrderApi.pendingSignature(id)) throw new Error('请先查询原签名请求');
        if (!active() || !this.hasAgreement(id, record.value)) throw new Error('请先阅读并同意当前合同');
        const saved = await new Promise<string>((resolve, reject) => wx.getFileSystemManager().saveFile({ tempFilePath: file, success: v => resolve(v.savedFilePath), fail: reject }));
        if (!active() || readStoredApiSession()?.accountId !== account) { removeLocalFile(saved); throw new Error('页面已变化，请重新打开合同'); }
        const attempt = record.value.current_attempt;
        const draft: SignatureUploadDraft = {
            owner: account, orderId: id, contractETag: record.etag, failure: null,
            create: { client_signature_id: newIdempotencyKey('signature'), signature_material_id: '', agreement_sha256: record.value.agreement_sha256, order_terms_sha256: record.value.order_terms_sha256, replaces_attempt_id: attempt?.attempt_id ?? null, replaces_attempt_version: attempt?.version ?? null },
            upload: createMaterialUploadIntent({ owner: account, field: 'contract-signature', item: id, generation: Date.now(), file: saved, key: newIdempotencyKey('signature-upload'), materialClass: 'CONTRACT_SIGNATURE_IMAGE' }),
        };
        try { save(draft); } catch (error) { removeLocalFile(saved); throw error; }
        return draft;
    },
    forgetAccepted(draft: SignatureUploadDraft) {
        const current = demoStorage.getStorageSync(slot(draft.owner, draft.orderId)) as SignatureUploadDraft | undefined;
        if (current?.create.client_signature_id !== draft.create.client_signature_id) return;
        demoStorage.removeStorageSync(slot(draft.owner, draft.orderId)); removeLocalFile(draft.upload.file);
    },
    discardRejected(draft: SignatureUploadDraft) {
        if (owner() !== draft.owner || draft.upload.phase !== 'FAILED' && !draft.failure || rentalOrderApi.pendingSignature(draft.orderId)) throw new Error('上传结果待核实，不能丢弃原请求');
        this.forgetAccepted(draft);
    },
};

export async function submitRentalSignature(draft: SignatureUploadDraft, options: { scope: OperationScope; active: () => boolean; recovery: boolean; changed: (phase: string, progress: number) => void }): Promise<RentalRecord<RentalSignature> | null> {
    const active = () => options.active() && readStoredApiSession()?.accountId === draft.owner;
    if (!active()) return null;
    const pending = rentalOrderApi.pendingSignature(draft.orderId);
    if (pending) {
        if (pending.body.client_signature_id !== draft.create.client_signature_id) throw new Error('原签名意图不匹配');
        const found = await rentalOrderApi.signature(draft.orderId, draft.create.client_signature_id).promise;
        if (!active()) return null;
        if (found.value.attempt) { rentalSignatureDrafts.forgetAccepted(draft); return { value: found.value.attempt, etag: found.etag }; }
        if (!options.recovery) throw new Error('本次未查到签名，请显式恢复原请求');
        const result = await rentalOrderApi.recoverSignature(draft.orderId).promise;
        rentalSignatureDrafts.forgetAccepted(draft); return active() ? result : null;
    }
    try {
        if (draft.upload.phase !== 'READY') await runMaterialUpload(draft.upload, {
            scope: options.scope, isCurrent: active, explicitRecovery: options.recovery,
            onState: () => { save(draft); options.changed(draft.upload.phase, draft.upload.progress); },
        }).promise;
    } finally { save(draft); }
    if (!active()) return null;
    if (!draft.upload.materialId) throw new Error('签名原图尚未就绪');
    draft.create.signature_material_id = draft.upload.materialId; save(draft);
    try {
        const result = await rentalOrderApi.createSignature(draft.orderId, draft.create, draft.contractETag).promise;
        rentalSignatureDrafts.forgetAccepted(draft);
        return active() ? result : null;
    } catch (error) {
        if (active() && error instanceof ApiProblem && error.statusCode >= 400 && error.statusCode < 500 && !rentalOrderApi.pendingSignature(draft.orderId)) { draft.failure = error.message; save(draft); }
        throw error;
    }
}
