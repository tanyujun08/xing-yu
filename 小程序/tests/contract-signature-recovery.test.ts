import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { rentalOrderApi, type RentalSignatureCreate } from '../miniprogram/shared/api/rental-order-api';
import { signatureStrokeQuality } from '../miniprogram/shared/model/contract-signature';
import { validContractArtifact } from '../miniprogram/shared/presentation/contract-signature';
interface Wire { url: string; method: string; data: unknown; header: Record<string, string>; success(v: unknown): void; fail(v: { errMsg: string }): void }
const calls: Wire[] = [], storage = new Map<string, unknown>();
let transport: (v: Wire) => void;
const body: RentalSignatureCreate = { client_signature_id: 'signature:original:01', signature_material_id: 'ink-01', agreement_sha256: 'a'.repeat(64), order_terms_sha256: 'b'.repeat(64), replaces_attempt_id: null, replaces_attempt_version: null };
const attempt = (status = 'BUILDING') => ({ attempt_id: 'attempt-1', client_signature_id: body.client_signature_id, status, version: '2', preview_artifact_id: status === 'BUILDING' ? null : 'artifact-1', preview_sha256: status === 'BUILDING' ? null : 'c'.repeat(64), error_code: null, allowed_actions: [], expires_at: '2026-10-09T23:00:00Z', confirmed_at: null });
const reply = (v: Wire, data: unknown) => v.success({ statusCode: 200, data, header: { ETag: '"SIGNATURE_ATTEMPT:attempt-1:2"' } });
const create = () => rentalOrderApi.createSignature('order-1', body, '"CONTRACT:contract-1:1"');
beforeEach(() => {
    calls.length = 0; storage.clear(); storage.set('xingyu.api-session.v1', { accountId: 'tenant', accessToken: 'fixture-token', refreshToken: 'r', expiresAt: Date.now() + 120000 });
    transport = v => v.fail({ errMsg: 'request:fail timeout' });
    vi.stubGlobal('wx', { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }), getStorageSync: (key: string) => storage.get(key), setStorageSync: (key: string, value: unknown) => storage.set(key, structuredClone(value)), removeStorageSync: (key: string) => storage.delete(key), request: (v: Wire) => { calls.push(v); transport(v); return { abort: vi.fn() }; } });
});
afterEach(() => vi.unstubAllGlobals());
test('NOT_FOUND is only a read result; explicit recovery preserves the original file hash version and key', async () => {
    await expect(create().promise).rejects.toBeDefined(); const original = calls[0]!;
    transport = v => reply(v, { state: 'NOT_FOUND', attempt: null });
    await rentalOrderApi.signature('order-1', body.client_signature_id).promise;
    expect(rentalOrderApi.pendingSignature('order-1')?.body).toEqual(body); expect(calls[1]?.method).toBe('GET'); expect(calls).toHaveLength(2);
    transport = v => reply(v, attempt()); await rentalOrderApi.recoverSignature('order-1').promise;
    expect(calls[2]?.data).toEqual(body); expect(calls[2]?.header['Idempotency-Key']).toBe(original.header['Idempotency-Key']); expect(calls[2]?.header['If-Match']).toBe(original.header['If-Match']); expect(rentalOrderApi.pendingSignature('order-1')).toBeNull();
});
test('only a matching FOUND retires an unknown create, with no automatic write', async () => {
    await expect(create().promise).rejects.toBeDefined();
    transport = v => reply(v, { state: 'FOUND', attempt: { ...attempt(), client_signature_id: 'different-signature' } });
    await expect(rentalOrderApi.signature('order-1', body.client_signature_id).promise).rejects.toThrow('身份不匹配'); expect(rentalOrderApi.pendingSignature('order-1')).not.toBeNull();
    transport = v => reply(v, { state: 'FOUND', attempt: attempt() }); await rentalOrderApi.signature('order-1', body.client_signature_id).promise;
    expect(rentalOrderApi.pendingSignature('order-1')).toBeNull(); expect(calls.filter(c => c.method === 'POST')).toHaveLength(1);
});
test('an unknown confirmation cannot switch artifact and only the same confirmed bytes resolve it', async () => {
    const confirm = { preview_artifact_id: 'artifact-1', preview_sha256: 'c'.repeat(64), accepted: true as const };
    await expect(rentalOrderApi.confirmSignature('order-1', body.client_signature_id, confirm, '"SIGNATURE_ATTEMPT:attempt-1:2"').promise).rejects.toBeDefined();
    expect(() => rentalOrderApi.confirmSignature('order-1', body.client_signature_id, { ...confirm, preview_artifact_id: 'other' }, '"SIGNATURE_ATTEMPT:attempt-1:3"')).toThrow('原请求结果待核实');
    transport = v => reply(v, { state: 'FOUND', attempt: { ...attempt('CONFIRMED'), preview_sha256: 'd'.repeat(64) } }); await rentalOrderApi.signature('order-1', body.client_signature_id).promise;
    expect(rentalOrderApi.pendingSignatureConfirmation('order-1', body.client_signature_id)).not.toBeNull();
    transport = v => reply(v, { state: 'FOUND', attempt: attempt('CONFIRMED') }); await rentalOrderApi.signature('order-1', body.client_signature_id).promise;
    expect(rentalOrderApi.pendingSignatureConfirmation('order-1', body.client_signature_id)).toBeNull();
});

test('explicit confirmation retry after PREVIEW_READY reuses the original body key and version', async () => {
    const confirm = { preview_artifact_id: 'artifact-1', preview_sha256: 'c'.repeat(64), accepted: true as const };
    await expect(rentalOrderApi.confirmSignature('order-1', body.client_signature_id, confirm, '"SIGNATURE_ATTEMPT:attempt-1:2"').promise).rejects.toBeDefined();
    const original = calls[0]!;
    transport = v => reply(v, { state: 'FOUND', attempt: attempt('PREVIEW_READY') });
    await rentalOrderApi.signature('order-1', body.client_signature_id).promise;
    expect(calls.filter(c => c.method === 'POST')).toHaveLength(1);
    expect(rentalOrderApi.pendingSignatureConfirmation('order-1', body.client_signature_id)).not.toBeNull();
    transport = v => reply(v, { status: 'SUCCEEDED' });
    await rentalOrderApi.confirmSignature('order-1', body.client_signature_id, confirm, '"SIGNATURE_ATTEMPT:attempt-1:3"').promise;
    expect(calls[2]?.url).toBe(original.url);
    expect(calls[2]?.data).toEqual(original.data);
    expect(calls[2]?.header['Idempotency-Key']).toBe(original.header['Idempotency-Key']);
    expect(calls[2]?.header['If-Match']).toBe(original.header['If-Match']);
    expect(rentalOrderApi.pendingSignatureConfirmation('order-1', body.client_signature_id)).toBeNull();
});

test('unknown render retry is queried without replay and explicit recovery preserves its original key and version', async () => {
    await expect(rentalOrderApi.retrySignatureRender('order-1', body.client_signature_id, '"SIGNATURE_ATTEMPT:attempt-1:2"').promise).rejects.toBeDefined();
    const original = calls[0]!;
    expect(rentalOrderApi.pendingSignatureRender('order-1', body.client_signature_id)).not.toBeNull();
    transport = v => reply(v, { state: 'FOUND', attempt: attempt('RENDER_FAILED') });
    await rentalOrderApi.signature('order-1', body.client_signature_id).promise;
    expect(calls.filter(c => c.method === 'POST')).toHaveLength(1);
    expect(rentalOrderApi.pendingSignatureRender('order-1', body.client_signature_id)).not.toBeNull();
    transport = v => reply(v, attempt('BUILDING'));
    await rentalOrderApi.retrySignatureRender('order-1', body.client_signature_id, '"SIGNATURE_ATTEMPT:attempt-1:3"').promise;
    expect(calls[2]?.url).toBe(original.url); expect(calls[2]?.data).toEqual({});
    expect(calls[2]?.header['Idempotency-Key']).toBe(original.header['Idempotency-Key']);
    expect(calls[2]?.header['If-Match']).toBe(original.header['If-Match']);
    expect(rentalOrderApi.pendingSignatureRender('order-1', body.client_signature_id)).toBeNull();
});
test('blank, tap and short strokes cannot save while normalized handwriting can', () => {
    expect(signatureStrokeQuality([], 358, 440)).toBe(false); expect(signatureStrokeQuality([[{ x: .5, y: .5 }]], 358, 440)).toBe(false);
    expect(signatureStrokeQuality([Array.from({ length: 20 }, (_, i) => ({ x: .5 + i / 10000, y: .5 }))], 358, 440)).toBe(false);
    expect(signatureStrokeQuality([Array.from({ length: 20 }, (_, i) => ({ x: .2 + i / 50, y: .3 + Math.sin(i) / 10 }))], 358, 440)).toBe(true);
    expect(signatureStrokeQuality([[{ x: NaN, y: .5 }]], 358, 440)).toBe(false);
});
test('preview validation binds all pages to OSS and rejects a clipped or nonfinite signature anchor', () => {
    const url = 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/contracts/fixture', artifact = { artifact_id: 'artifact-1', document_material_id: 'pdf-1', document_sha256: 'a'.repeat(64), document_url: url + '.pdf', page_count: 1, pages: [{ page_no: 1, material_id: 'page-1', sha256: 'b'.repeat(64), url: url + '.png' }], renderer_version: 'fixture', anchor_snapshot_json: [{ role: 'TENANT_MAIN' as const, page_no: 1, x: .1, y: .8, w: .5, h: .1 }] };
    expect(validContractArtifact(artifact)).toBe(true); expect(validContractArtifact({ ...artifact, page_count: 2 })).toBe(false);
    expect(validContractArtifact({ ...artifact, document_url: 'https://unknown.invalid/file.pdf' })).toBe(false);
    expect(validContractArtifact({ ...artifact, anchor_snapshot_json: [{ ...artifact.anchor_snapshot_json[0]!, y: .95 }] })).toBe(false);
    expect(validContractArtifact({ ...artifact, anchor_snapshot_json: [{ ...artifact.anchor_snapshot_json[0]!, x: NaN }] })).toBe(false);
});
