import { demoStorage } from '../../preview/storage';
import { request, type RequestHandle, type RequestOptions } from './request';
import type { components } from '../../../types/api/schema';
import { readStoredApiSession } from '../session/api-session';
import { newIdempotencyKey } from './idempotency';
import { ApiProblem } from './problem';
type S = components['schemas'];
export type RentalOrder = S['OrderDetail'];
export type RentalOrderSummary = S['OrderSummary'];
export type RentalAction = S['Action'];
export type RentalQuote = S['QuoteView'];
export type RentalSelection = S['QuoteRequest'];
export type RentalContract = S['ContractView'];
export type RentalSignature = S['SignatureAttempt'];
export type RentalSignatureCreate = S['SignatureCreate'];
export type RentalContractArtifact = S['ContractArtifact'];
export type RentalReturn = S['ReturnView'];
export type RentalTask = S['CabinetTask'];
export type RentalRecord<T> = {
    value: T;
    etag: string;
};
export type RentalPayment = S['PaymentView'];
export type RentalEvidence = S['EvidenceRef'];
export type RentalIncome = S['EarningView'];
export type RentalListFilter = {
    role: 'TENANT' | 'LESSOR';
    display_status_code?: string;
    physical_status?: S['Physical'];
    asset_id?: string;
    cursor?: string | undefined;
};
const pathId = (id: string) => encodeURIComponent(id);
const orderPath = (id: string) => '/v1/me/rental-orders/' + pathId(id);
function read<T>(options: RequestOptions<object>): RequestHandle<RentalRecord<T>> {
    let etag = '';
    const handle = request<T, object>({ ...options, onResponseHeaders: headers => { etag = headers['etag'] ?? ''; } });
    return { abort: handle.abort, promise: handle.promise.then(value => ({ value, etag })) };
}
function query(values: Record<string, string | undefined>) {
    return Object.entries(values).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value!)).join('&');
}
type Intent = {
    owner: string;
    path: string;
    body: object;
    etag: string;
    key: string;
};
const intentPrefix = 'xingyu.rental-command.v1:';
function intentStorage(owner: string, path: string) { return intentPrefix + encodeURIComponent(owner) + ':' + encodeURIComponent(path); }
function ownerIdentity() { const owner = readStoredApiSession()?.accountId; if (!owner)
    throw new Error('请先登录'); return owner; }
function savedIntent(owner: string, path: string): Intent | null {
    const value: unknown = demoStorage.getStorageSync(intentStorage(owner, path));
    if (!value)
        return null;
    if (typeof value !== 'object' || !('owner' in value) || value.owner !== owner || !('path' in value) || value.path !== path || !('body' in value) || !value.body || !('key' in value) || typeof value.key !== 'string' || !('etag' in value) || typeof value.etag !== 'string')
        throw new Error('原请求记录不完整，请联系客服核实');
    return value as Intent;
}
function write<T>(path: string, body: object, etag = '', method: 'POST' | 'PUT' = 'POST'): RequestHandle<RentalRecord<T>> {
    const owner = ownerIdentity();
    const previous = savedIntent(owner, path);
    if (previous && JSON.stringify(previous.body) !== JSON.stringify(body))
        throw new Error('原请求结果待核实，请先查询原订单；不能更换内容再次提交');
    if (!previous && etag && !/^"[A-Za-z0-9._:-]{1,128}"$/.test(etag))
        throw new Error('对象版本不可用，请刷新后操作');
    const intent = previous ?? { owner, path, body: JSON.parse(JSON.stringify(body)) as object, etag, key: newIdempotencyKey('rental') };
    demoStorage.setStorageSync(intentStorage(owner, path), intent);
    if (savedIntent(owner, path)?.key !== intent.key)
        throw new Error('原请求未能保存，尚未提交');
    const handle = read<T>({ path, method, body: intent.body, idempotencyKey: intent.key, ...(intent.etag ? { aggregateVersion: intent.etag } : {}) });
    return { abort: handle.abort, promise: handle.promise.then(result => { if (readStoredApiSession()?.accountId === owner)
            demoStorage.removeStorageSync(intentStorage(owner, path)); return result; }, (error: unknown) => {
            if (error instanceof ApiProblem) {
                // A recovery rejected by authentication cannot establish the result of the earlier unknown request.
                const unresolvedRecovery = previous !== null && (error.statusCode === 401 || error.statusCode === 403 || error.code === 'SESSION_CHANGED');
                // An initial pickup refusal rolls back before dispatch; a refusal while replaying an unknown intent cannot establish its earlier result.
                const initialPickupRefusal = previous === null && (path === '/v1/me/cabinet-pickups' || /^\/v1\/me\/rental-cabinet-tasks\/[^/]+\/open$/.test(path)) && error.statusCode === 409 && error.code === 'RESOURCE_CONFLICT' && error.details?.['reason_code'] === 'PICKUP_UNAVAILABLE';
                const initialSlotRefusal = previous === null && /\/return\/evidence-slots\/[^/]+\/items\/\d+$/.test(path) && error.statusCode === 409 && error.code === 'RESOURCE_CONFLICT' && /^RETURN_(EVIDENCE_|MATERIAL_ALREADY_BOUND)/.test(String(error.details?.['reason_code'] ?? ''));
                const initialSignatureRefusal = previous === null && /\/contract\/signature-attempts(?:\/[^/]+\/(?:confirm|render-retry))?$/.test(path) && error.statusCode === 409 && error.code === 'RESOURCE_CONFLICT' && ['CONTRACT_EXPIRED', 'REAL_NAME_REQUIRED', 'CONTRACT_TERMS_CHANGED', 'SIGNATURE_ATTEMPT_EXISTS', 'SIGNATURE_NOT_REPLACEABLE', 'SIGNATURE_SUPERSEDED', 'SIGNATURE_NOT_RETRYABLE', 'CONTRACT_PREVIEW_CHANGED'].includes(String(error.details?.['reason_code'] ?? ''));
                if (initialPickupRefusal || initialSlotRefusal || initialSignatureRefusal || !unresolvedRecovery && ((error.statusCode >= 400 && error.statusCode < 500 && ![408, 409, 429].includes(error.statusCode)) || ['QUOTE_CHANGED', 'VERSION_CONFLICT'].includes(error.code) || error.details?.['reason_code'] === 'RENTAL_NOT_STARTED'))
                    demoStorage.removeStorageSync(intentStorage(owner, path));
            }
            throw error;
        }) };
}
function version(etag: string) { if (!etag)
    throw new Error('未读取到对象版本，请刷新'); return etag; }
function pendingShipment(id: string) {
    const owner = ownerIdentity();
    for (const correction of [false, true]) {
        const intent = savedIntent(owner, orderPath(id) + (correction ? '/shipment/corrections' : '/shipment'));
        if (!intent) continue;
        const body = intent.body as Partial<S['ShippingCorrection']>;
        if (typeof body.tracking_no !== 'string' || !/^\S{1,64}$/.test(body.tracking_no) || !(body.carrier === null || typeof body.carrier === 'string' && body.carrier.length <= 64)
            || correction && (typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 500)) throw new Error('原物流请求记录不完整，请联系客服核实');
        return { correction, body: { tracking_no: body.tracking_no, carrier: body.carrier, ...(correction ? { reason: body.reason! } : {}) }, etag: intent.etag };
    }
    return null;
}
export const rentalOrderApi = {
    pendingShipment,
    quote: (body: RentalSelection) => read<RentalQuote>({ path: '/v1/me/rental-quotes', method: 'POST', body }),
    prepare: (body: S['PreparationRequest']) => write<RentalOrder>('/v1/me/rental-orders/preparations', body),
    pendingPreparation: () => savedIntent(ownerIdentity(), '/v1/me/rental-orders/preparations'),
    lookup: (operation: 'B02' | 'K10', key: string) => { const owner = ownerIdentity(), path = operation === 'B02' ? '/v1/me/rental-orders/preparations' : '/v1/me/cabinet-pickups'; const handle = read<S['LookupView']>({ path: '/v1/me/rental-command-results/lookup', method: 'POST', body: { operation_id: operation, target_id: null, idempotency_key: key } }); return { abort: handle.abort, promise: handle.promise.then(record => { if (readStoredApiSession()?.accountId === owner && savedIntent(owner, path)?.key === key && (record.value.state === 'COMPLETED' && record.value.result !== null || record.value.state === 'FAILED' && !record.value.retry_same_request))
            demoStorage.removeStorageSync(intentStorage(owner, path)); return record; }) }; },
    get: (id: string) => read<RentalOrder>({ path: orderPath(id) }),
    list: (filter: RentalListFilter) => read<S['OrderPage']>({ path: '/v1/me/rental-orders?' + query({ ...filter, limit: '20', include_preparing: 'true' }) }),
    confirm: (id: string, etag: string) => write<RentalOrder>(orderPath(id) + '/confirm', {}, version(etag)),
    cancel: (id: string, etag: string) => write<S['CommandResult']>(orderPath(id) + '/cancel-unpaid', {}, version(etag)),
    createPayment: (id: string, purpose: 'INITIAL' | 'SUPPLEMENT', etag: string, supplement_id: string | null) => write<RentalPayment>(orderPath(id) + '/payments', { purpose, supplement_id }, version(etag)),
    paymentHistory: (id: string, cursor?: string) => read<S['PaymentHistoryPage']>({ path: orderPath(id) + '/payments?' + query({ limit: '20', cursor }) }),
    refundHistory: (id: string, cursor?: string) => read<S['RefundHistoryPage']>({ path: orderPath(id) + '/refunds?' + query({ limit: '20', cursor }) }),
    payment: (id: string) => read<RentalPayment>({ path: '/v1/me/rental-payments/' + pathId(id) }),
    invocation: (id: string, etag: string) => write<S['Invocation']>('/v1/me/rental-payments/' + pathId(id) + '/invocation', {}, version(etag)),
    queryPayment: (id: string, etag: string) => write<S['CommandResult']>('/v1/me/rental-payments/' + pathId(id) + '/reconciliation', {}, version(etag)),
    refund: (id: string) => read<S['RefundView']>({ path: '/v1/me/rental-refunds/' + pathId(id) }),
    queryRefund: (id: string, etag: string) => write<S['CommandResult']>('/v1/me/rental-refunds/' + pathId(id) + '/reconciliation', {}, version(etag)),
    contract: (id: string) => read<RentalContract>({ path: orderPath(id) + '/contract' }),
    createSignature: (id: string, body: RentalSignatureCreate, etag: string) => write<RentalSignature>(signaturePath(id), body, version(etag)),
    pendingSignature: (id: string) => pendingSignature(id),
    recoverSignature: (id: string) => { const pending = pendingSignature(id); if (!pending) throw new Error('没有待查询的签名请求'); return write<RentalSignature>(signaturePath(id), pending.body, pending.etag); },
    signature: (id: string, clientId: string) => {
        const owner = ownerIdentity(), path = signaturePath(id);
        const handle = read<S['SignatureAttemptLookup']>({ path: path + '/' + pathId(clientId) });
        return { abort: handle.abort, promise: handle.promise.then(record => {
            const attempt = record.value.attempt;
            if (record.value.state === 'FOUND' && (!attempt || attempt.client_signature_id !== clientId) || record.value.state === 'NOT_FOUND' && attempt !== null) throw new Error('签名查询身份不匹配，请重查原请求');
            if (attempt && readStoredApiSession()?.accountId === owner) {
                const create = pendingSignature(id);
                if (create?.body.client_signature_id === clientId) demoStorage.removeStorageSync(intentStorage(owner, path));
                const confirmPath = path + '/' + pathId(clientId) + '/confirm', confirm = savedIntent(owner, confirmPath);
                if (attempt.status === 'CONFIRMED' && confirm && 'preview_artifact_id' in confirm.body && 'preview_sha256' in confirm.body && confirm.body.preview_artifact_id === attempt.preview_artifact_id && confirm.body.preview_sha256 === attempt.preview_sha256) demoStorage.removeStorageSync(intentStorage(owner, confirmPath));
                const retryPath = path + '/' + pathId(clientId) + '/render-retry';
                if (['BUILDING', 'PREVIEW_READY', 'CONFIRMED'].includes(attempt.status)) demoStorage.removeStorageSync(intentStorage(owner, retryPath));
            }
            return record;
        }) };
    },
    confirmSignature: (id: string, clientId: string, body: S['SignatureConfirm'], etag: string) => write<RentalSignature>(signaturePath(id) + '/' + pathId(clientId) + '/confirm', body, version(etag)),
    pendingSignatureConfirmation: (id: string, clientId: string) => savedIntent(ownerIdentity(), signaturePath(id) + '/' + pathId(clientId) + '/confirm'),
    pendingSignatureRender: (id: string, clientId: string) => savedIntent(ownerIdentity(), signaturePath(id) + '/' + pathId(clientId) + '/render-retry'),
    retrySignatureRender: (id: string, clientId: string, etag: string) => write<RentalSignature>(signaturePath(id) + '/' + pathId(clientId) + '/render-retry', {}, version(etag)),
    contractArtifact: (id: string, artifactId: string) => read<RentalContractArtifact>({ path: orderPath(id) + '/contract/artifacts/' + pathId(artifactId) }),
    ship: (id: string, body: S['ShippingRequest'], etag: string) => write<RentalOrder>(orderPath(id) + '/shipment', body, version(etag)),
    correctShipment: (id: string, body: S['ShippingCorrection'], etag: string) => write<RentalOrder>(orderPath(id) + '/shipment/corrections', body, version(etag)),
    confirmDelivery: (id: string, etag: string) => write<RentalOrder>(orderPath(id) + '/delivery-confirmations', {}, version(etag)),
    startReturn: (id: string, method: 'CABINET' | 'EXPRESS', etag: string) => write<RentalReturn>(orderPath(id) + '/return-draft', { method }, version(etag)),
    return: (id: string) => read<RentalReturn>({ path: orderPath(id) + '/return' }),
    returnAddress: (id: string, addressId: string, etag: string) => write<RentalReturn>(orderPath(id) + '/return/address', { address_id: addressId }, version(etag)),
    returnShipment: (id: string, body: S['ReturnShippingRequest'], etag: string) => write<RentalReturn>(orderPath(id) + '/return/shipment', body, version(etag)),
    correctReturnShipment: (id: string, body: S['ReturnShippingCorrection'], etag: string) => write<RentalReturn>(orderPath(id) + '/return/shipment/corrections', body, version(etag)),
    saveReturnEvidence: (id: string, slot: string, item: number, body: S['ReturnEvidenceItemRequest'], etag: string) => write<RentalReturn>(evidencePath(id, slot, item), body, version(etag), 'PUT'),
    pendingReturnEvidence: (id: string, slot: string, item: number) => savedIntent(ownerIdentity(), evidencePath(id, slot, item)),
    recoverReturnEvidence: (id: string, slot: string, item: number) => { const path = evidencePath(id, slot, item), pending = savedIntent(ownerIdentity(), path); if (!pending) throw new Error('没有待恢复的凭证保存'); return write<RentalReturn>(path, pending.body, pending.etag, 'PUT'); },
    receipt: (id: string, body: S['ReceiptRequest'], etag: string) => write<RentalReturn>(orderPath(id) + '/return/receipt', body, version(etag)),
    pickupCredential: (id: string) => read<S['PickupCredential']>({ path: orderPath(id) + '/pickup-credential' }),
    cabinetEntry: (scene: string) => read<S['CabinetEntry']>({ path: '/v1/cabinet-entry?scene=' + encodeURIComponent(scene), authenticated: false }),
    pickup: (scene: string, code: string) => write<RentalTask>('/v1/me/cabinet-pickups', { scene, pickup_code: code }),
    pickupTask: (scene: string): string | null => {
        const owner = ownerIdentity(), value: unknown = demoStorage.getStorageSync('xingyu.pickup-task.v1:' + owner + ':' + scene);
        if (!value) return null;
        if (typeof value !== 'object' || !('owner' in value) || value.owner !== owner || !('scene' in value) || value.scene !== scene || !('taskId' in value) || typeof value.taskId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value.taskId))
            throw new Error('原取件任务记录不完整，请返回订单核实');
        return value.taskId;
    },
    rememberPickupTask: (scene: string, taskId: string) => { const owner = ownerIdentity(); demoStorage.setStorageSync('xingyu.pickup-task.v1:' + owner + ':' + scene, { owner, scene, taskId }); },
    forgetPickupTask: (scene: string, taskId: string) => { const owner = ownerIdentity(); if (rentalOrderApi.pickupTask(scene) === taskId) demoStorage.removeStorageSync('xingyu.pickup-task.v1:' + owner + ':' + scene); },
    pendingPickup: () => savedIntent(ownerIdentity(), '/v1/me/cabinet-pickups'),
    cabinets: (id: string, cursor?: string) => read<S['CabinetOptions']>({ path: orderPath(id) + '/cabinet-options?' + query({ purpose: 'RETURN', cursor, limit: '20' }) }),
    reserveCabinet: (id: string, cabinetId: string, compartmentId: string, etag: string) => write<RentalTask>(orderPath(id) + '/cabinet-tasks', { purpose: 'RETURN', cabinet_id: cabinetId, compartment_id: compartmentId }, version(etag)),
    task: (id: string) => read<RentalTask>({ path: '/v1/me/rental-cabinet-tasks/' + pathId(id) }),
    openCabinet: (id: string, code: string | null, etag: string) => write<RentalTask>('/v1/me/rental-cabinet-tasks/' + pathId(id) + '/open', { pickup_code: code }, version(etag)),
    cancelCabinet: (id: string, etag: string) => write<RentalTask>('/v1/me/rental-cabinet-tasks/' + pathId(id) + '/cancel', {}, version(etag)),
    queryCabinet: (id: string, etag: string) => write<S['CommandResult']>('/v1/me/rental-cabinet-tasks/' + pathId(id) + '/reconciliation', {}, version(etag)),
    confirmCabinetReturn: (id: string, etag: string) => write<RentalTask>('/v1/me/rental-cabinet-tasks/' + pathId(id) + '/confirm-return', {}, version(etag)),
    income: () => read<S['WalletSummary']>({ path: '/v1/me/rental-income' }),
    earnings: (cursor?: string) => read<S['EarningPage']>({ path: '/v1/me/rental-earnings?' + query({ cursor, limit: '20' }) }),
    earning: (id: string) => read<RentalIncome>({ path: '/v1/me/rental-earnings/' + pathId(id) }),
};
function evidencePath(id: string, slot: string, item: number) { return orderPath(id) + '/return/evidence-slots/' + pathId(slot) + '/items/' + item; }
function signaturePath(id: string) { return orderPath(id) + '/contract/signature-attempts'; }
function pendingSignature(id: string): (Intent & { body: RentalSignatureCreate }) | null {
    const intent = savedIntent(ownerIdentity(), signaturePath(id));
    if (!intent) return null;
    const body = intent.body as Partial<RentalSignatureCreate>;
    if (typeof body.client_signature_id !== 'string' || !/^[!-~]{16,64}$/.test(body.client_signature_id) || !body.signature_material_id || !/^[a-f0-9]{64}$/.test(body.agreement_sha256 ?? '') || !/^[a-f0-9]{64}$/.test(body.order_terms_sha256 ?? '') || (body.replaces_attempt_id === null) !== (body.replaces_attempt_version === null)) throw new Error('原签名请求记录不完整，请联系客服核实');
    return intent as Intent & { body: RentalSignatureCreate };
}
