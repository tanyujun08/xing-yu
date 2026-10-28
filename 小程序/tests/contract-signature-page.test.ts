import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
const m = vi.hoisted(() => ({ owner: 'tenant' as string | null, get: vi.fn(), contract: vi.fn(), pendingSignature: vi.fn(), signature: vi.fn(), contractArtifact: vi.fn(), pendingSignatureConfirmation: vi.fn(), pendingSignatureRender: vi.fn(), confirmSignature: vi.fn(), recoverSignature: vi.fn(), retrySignatureRender: vi.fn(), draftRead: vi.fn(), agree: vi.fn(), forget: vi.fn(), download: vi.fn() }));
vi.mock('../miniprogram/shared/api/account-api', () => ({ accountApi: { sessionIdentity: () => m.owner } }));
vi.mock('../miniprogram/shared/api/rental-api', () => ({ rentalOrderApi: m, rentalSignatureDrafts: { read: m.draftRead, agree: m.agree, forgetAccepted: m.forget }, downloadRentalContract: m.download }));
type Harness = { data: Record<string, unknown>; setData(patch: Record<string, unknown>, callback?: () => void): void; [key: string]: unknown };
let page: Harness | undefined;
const record = (value: unknown, etag = '"CONTRACT:c1:1"') => ({ promise: Promise.resolve({ value, etag }), abort: vi.fn() });
const action = (action_code: string, allowed = true) => ({ action_code, allowed, reason_code: null, display_reason: null });
const url = 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/contracts/fixture';
const artifact = () => ({ artifact_id: 'artifact-1', document_material_id: 'pdf-1', document_sha256: 'c'.repeat(64), document_url: url + '.pdf', page_count: 2, pages: [1, 2].map(page_no => ({ page_no, material_id: 'page-' + page_no, sha256: 'd'.repeat(64), url: url + page_no + '.png' })), renderer_version: 'fixture', anchor_snapshot_json: [{ role: 'TENANT_MAIN', page_no: 2, x: .1, y: .5, w: .4, h: .1 }] });
const attempt = () => ({ attempt_id: 'attempt-1', client_signature_id: 'signature-original-1', version: '2', status: 'PREVIEW_READY', preview_artifact_id: 'artifact-1', preview_sha256: 'c'.repeat(64), error_code: null, allowed_actions: [action('CONFIRM_SIGNATURE'), action('REWRITE_SIGNATURE')], expires_at: '2026-10-09T23:00:00Z', confirmed_at: null });
const contract = (preview = false) => ({ contract_id: 'c1', order_id: 'o1', status: 'PENDING', version: '1', template_version_id: 'template-1', document_template: { template_version_id: 'template-1', source_docx_sha256: 'e'.repeat(64) }, agreement_text: '完整原文合同\n第二条', agreement_sha256: 'a'.repeat(64), order_terms_sha256: 'b'.repeat(64), lessor_signature: { name: '李四', mode: 'DEFAULT_SIGNED', signed_at: null }, tenant_signature: { name: '张三', account_id: 'tenant', status: 'PENDING', signed_at: null }, current_attempt: preview ? attempt() : null, final_artifact: null, allowed_actions: [action('SIGN_CONTRACT', !preview)], blockers: [], expires_at: '2026-10-09T23:00:00Z', quota_state: 'RESERVED', quota_valid_until: null });
const order = () => ({ order: { order_id: 'o1', order_no: 'N1', asset: { title: '测试相机', cover_media: null }, rental_start_at: '2026-10-10T00:00:00Z', rental_end_at: '2026-10-11T00:00:00Z' }, fees: { rent_gross_fen: '1000', rent_discount_fen: '100', deposit_due_fen: '5000', initial_due_fen: '5900' } });
function deferred() { let resolve!: (value: unknown) => void, reject!: (error: unknown) => void; return { promise: new Promise<unknown>((a, b) => { resolve = a; reject = b; }), resolve, reject, abort: vi.fn() }; }
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function call(name: string, ...args: unknown[]) { return (page![name] as (...args: unknown[]) => unknown).apply(page, args); }
async function mount(preview = false) {
    let definition!: Harness; vi.stubGlobal('Page', (v: Harness) => definition = v); m.contract.mockReturnValue(record(contract(preview)));
    await import('../miniprogram/pages/contract/index'); page = { ...definition, data: structuredClone(definition.data), setData(patch, callback) { Object.assign(this.data, patch); callback?.(); } };
    call('onLoad', { orderId: 'o1' }); call('onShow'); await tick();
}
function checkPreview() { call('previewLoaded', { currentTarget: { dataset: { artifact: 'artifact-1' } } }); call('togglePreview'); }
beforeEach(() => {
    vi.resetModules(); vi.resetAllMocks(); m.owner = 'tenant'; page = undefined;
    m.get.mockReturnValue(record(order())); m.pendingSignature.mockReturnValue(null); m.pendingSignatureConfirmation.mockReturnValue(null); m.pendingSignatureRender.mockReturnValue(null); m.draftRead.mockReturnValue(null);
    m.signature.mockReturnValue(record({ state: 'FOUND', attempt: attempt() }, '"SIGNATURE_ATTEMPT:attempt-1:2"')); m.contractArtifact.mockReturnValue(record(artifact())); m.confirmSignature.mockReturnValue(record(contract(true)));
    vi.stubGlobal('wx', { navigateTo: vi.fn(), navigateBack: vi.fn(), redirectTo: vi.fn(), switchTab: vi.fn(), previewImage: vi.fn(), openDocument: vi.fn() });
});
afterEach(() => { if (page) call('onUnload'); vi.unstubAllGlobals(); });
test.each([403,404])('first read %s stays unavailable, keeps safe recovery and never implies closed or signed', async statusCode=>{
    m.get.mockImplementation(()=>({promise:Promise.reject(Object.assign(new Error('请求的资源不可查看'),{statusCode})),abort:vi.fn()}));
    await mount();
    expect(page!.data).toMatchObject({loaded:false,loading:false,canSign:false,canConfirm:false,artifactId:'',statusTitle:'',tenantStatus:'',errorText:'请求的资源不可查看'});
    call('sign');await call('confirmSignature');expect(m.confirmSignature).not.toHaveBeenCalled();
    call('backToOrders');call('backToOrders');expect(wx.switchTab).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({url:'/pages/orders/index'}));
    const markup=readFileSync('miniprogram/pages/contract/index.wxml','utf8');
    expect(markup).toContain('wx:if="{{!loaded && !loading && errorText}}"');
    expect(markup).toContain('暂时无法查看合同');expect(markup).toContain('open-type="contact">联系官方客服');
    expect(markup).toContain('bindtap="backToOrders"');expect(markup).toContain('wx:if="{{loaded && errorText}}"');
    m.get.mockReturnValue(record(order()));await call('refresh');expect(page!.data).toMatchObject({loaded:true,errorText:'',canSign:true});
});
test('reading alone never signs; acknowledged current terms open the tenant canvas once', async () => {
    await mount(); expect(page!.data).toMatchObject({ loaded: true, canSign: true, agreed: false, lessorName: '李四', rent: '¥9.00' });
    call('sign'); expect(wx.navigateTo).not.toHaveBeenCalled(); call('toggleText'); call('toggleAgree'); call('sign'); call('sign');
    expect(m.agree).toHaveBeenCalledWith('o1', expect.objectContaining({ agreement_sha256: 'a'.repeat(64) })); expect(wx.navigateTo).toHaveBeenCalledTimes(1); expect(m.confirmSignature).not.toHaveBeenCalled();
});
test('preview confirmation requires loaded page and explicit acknowledgement, using exact artifact and attempt ETag', async () => {
    await mount(true); await call('confirmSignature'); expect(m.confirmSignature).not.toHaveBeenCalled();
    checkPreview(); await call('confirmSignature');
    expect(m.confirmSignature).toHaveBeenCalledExactlyOnceWith('o1', 'signature-original-1', { accepted: true, preview_artifact_id: 'artifact-1', preview_sha256: 'c'.repeat(64) }, '"SIGNATURE_ATTEMPT:attempt-1:2"');
});
test('failed or changed preview disables signing and an old image callback cannot enable a new artifact', async () => {
    await mount(true); call('previewLoaded', { currentTarget: { dataset: { artifact: 'old-artifact' } } }); call('togglePreview'); await call('confirmSignature'); expect(m.confirmSignature).not.toHaveBeenCalled();
    checkPreview(); call('previewFailed', { currentTarget: { dataset: { artifact: 'artifact-1' } } }); await call('confirmSignature'); expect(m.confirmSignature).not.toHaveBeenCalled();
    m.contractArtifact.mockReturnValue(record({ ...artifact(), document_sha256: 'f'.repeat(64) })); await call('refresh'); expect(page!.data['canConfirm']).toBe(false); expect(page!.data['errorText']).toContain('不匹配');
});

test.each(['old-artifact', 'hidden', 'changed-account'])('a stale preview error cannot replace the current screen: %s', async boundary => {
    await mount(true); checkPreview();
    if (boundary === 'hidden') call('onHide');
    if (boundary === 'changed-account') m.owner = 'other';
    const shown = structuredClone(page!.data);
    call('previewFailed', { currentTarget: { dataset: { artifact: boundary === 'old-artifact' ? 'artifact-old' : 'artifact-1' } } });
    expect(page!.data).toEqual(shown); expect(m.confirmSignature).not.toHaveBeenCalled();
});
test('UNKNOWN create NOT_FOUND only offers explicit original recovery and forbids rewrite', async () => {
    m.pendingSignature.mockReturnValue({ body: { client_signature_id: 'signature-original-1' } }); m.signature.mockReturnValue(record({ state: 'NOT_FOUND', attempt: null })); await mount();
    expect(page!.data).toMatchObject({ unknown: true, recoverCreate: true, canSign: false, canRewrite: false }); expect(m.recoverSignature).not.toHaveBeenCalled();
    m.recoverSignature.mockReturnValue(record(attempt())); await call('recover'); expect(m.recoverSignature).toHaveBeenCalledExactlyOnceWith('o1');
});

test('UNKNOWN confirmation only offers an explicit retry of the matching original preview', async () => {
    m.pendingSignatureConfirmation.mockReturnValue({ body: { preview_artifact_id: 'artifact-1', preview_sha256: 'c'.repeat(64), accepted: true } });
    await mount(true);
    expect(page!.data).toMatchObject({ unknown: true, recoverConfirm: true, canConfirm: true, canRewrite: false, canSign: false });
    expect(m.confirmSignature).not.toHaveBeenCalled();
    call('sign'); expect(wx.navigateTo).not.toHaveBeenCalled();
    checkPreview(); await call('confirmSignature');
    expect(m.confirmSignature).toHaveBeenCalledExactlyOnceWith('o1', 'signature-original-1', { accepted: true, preview_artifact_id: 'artifact-1', preview_sha256: 'c'.repeat(64) }, '"SIGNATURE_ATTEMPT:attempt-1:2"');
});

test.each([
    { preview_artifact_id: 'another-artifact', preview_sha256: 'c'.repeat(64), accepted: true },
    { preview_artifact_id: 'artifact-1', preview_sha256: 'f'.repeat(64), accepted: true },
    { preview_artifact_id: 'artifact-1', preview_sha256: 'c'.repeat(64), accepted: false },
])('UNKNOWN confirmation with changed original content remains query-only: %j', async body => {
    m.pendingSignatureConfirmation.mockReturnValue({ body }); await mount(true);
    expect(page!.data).toMatchObject({ unknown: true, recoverConfirm: false, canConfirm: false, canRewrite: false, canSign: false });
    checkPreview(); await call('confirmSignature'); call('sign');
    expect(m.confirmSignature).not.toHaveBeenCalled(); expect(wx.navigateTo).not.toHaveBeenCalled();
});
test('an acknowledged contract changed by a fresh read must be acknowledged again', async () => {
    await mount(); call('toggleText'); call('toggleAgree'); m.contract.mockReturnValue(record({ ...contract(), agreement_sha256: 'f'.repeat(64) }, '"CONTRACT:c1:2"')); await call('refresh'); expect(page!.data['agreed']).toBe(false); expect(page!.data['fullText']).toBe(false); call('sign'); expect(wx.navigateTo).not.toHaveBeenCalled();
});

test('collapsed contract cannot be acknowledged; collapsing after reading revokes acknowledgement', async () => {
    await mount(); call('toggleAgree'); call('sign');
    expect(page!.data).toMatchObject({ fullText: false, agreed: false });
    expect(m.agree).not.toHaveBeenCalled(); expect(wx.navigateTo).not.toHaveBeenCalled();
    call('toggleText'); call('toggleAgree'); expect(page!.data['agreed']).toBe(true);
    call('toggleText'); call('sign'); expect(page!.data).toMatchObject({ fullText: false, agreed: false });
    expect(wx.navigateTo).not.toHaveBeenCalled();
});

test.each(['hidden', 'changed-account', 'refreshing'] as const)('reading controls cannot acknowledge stale content: %s', async boundary => {
    await mount(); call('toggleText');
    const pending = deferred(); let reading: unknown;
    if (boundary === 'hidden') call('onHide');
    else if (boundary === 'changed-account') m.owner = 'other';
    else { m.contract.mockReturnValueOnce(pending); reading = call('refresh'); await tick(); }
    const shown = structuredClone(page!.data);
    call('toggleAgree'); call('toggleText'); call('sign');
    expect(page!.data).toEqual(shown); expect(wx.navigateTo).not.toHaveBeenCalled();
    if (reading) { pending.resolve({ value: contract(), etag: '"CONTRACT:c1:1"' }); await reading; }
});
test.each(['expired', 'changed', 'hidden', 'new-view'] as const)('contract read respects %s ownership and never writes', async boundary => {
    await mount(); const pending = deferred(); m.contract.mockReturnValueOnce(pending); const reading = call('refresh'); await tick();
    if (boundary === 'hidden' || boundary === 'new-view') call('onHide');
    if (boundary === 'expired') m.owner = null; else if (boundary !== 'hidden') m.owner = 'other';
    if (boundary === 'new-view') { call('onShow'); await tick(); }
    const shown = structuredClone(page!.data); pending.resolve({ value: { ...contract(), agreement_text: 'old-private-text' }, etag: '"CONTRACT:c1:3"' }); await reading;
    if (boundary === 'expired' || boundary === 'changed') expect(page!.data).toMatchObject({ loaded: false, loading: false, agreementText: '', errorText: expect.stringContaining('登录') }); else expect(page!.data).toEqual(shown);
    expect(m.confirmSignature).not.toHaveBeenCalled();
});
test('older same-account read cannot replace the newest contract or loading', async () => {
    await mount(); const pending = deferred(); m.contract.mockReturnValueOnce(pending); const reading = call('refresh'); await tick();
    m.contract.mockReturnValue(record({ ...contract(), agreement_text: 'newest-text' }, '"CONTRACT:c1:2"')); await call('refresh');
    pending.resolve({ value: { ...contract(), agreement_text: 'stale-text' }, etag: '"CONTRACT:c1:1"' }); await reading;
    expect(page!.data).toMatchObject({ agreementText: 'newest-text', loading: false });
});
test.each(['expired', 'changed', 'hidden', 'new-view'] as const)('late signature command respects %s ownership with no automatic replay or navigation', async boundary => {
    await mount(true); checkPreview(); const pending = deferred(); m.confirmSignature.mockReturnValueOnce(pending); const writing = call('confirmSignature'); await tick(); expect(page!.data['busy']).toBe(true);
    if (boundary === 'hidden' || boundary === 'new-view') call('onHide');
    if (boundary === 'expired') m.owner = null; else if (boundary !== 'hidden') m.owner = 'other';
    if (boundary === 'new-view') { call('onShow'); await tick(); }
    const shown = structuredClone(page!.data); pending.reject(new Error('late-unknown')); await writing;
    if (boundary === 'expired' || boundary === 'changed') expect(page!.data).toMatchObject({ loaded: false, busy: false, agreementText: '', errorText: expect.stringContaining('登录') }); else expect(page!.data).toEqual(shown);
    expect(m.confirmSignature).toHaveBeenCalledTimes(1); expect(wx.redirectTo).not.toHaveBeenCalled();
});
test('412 clears preview acknowledgement and re-reads without a second confirmation', async () => {
    await mount(true); checkPreview(); m.confirmSignature.mockReturnValueOnce({ promise: Promise.reject(Object.assign(new Error('版本已变化'), { statusCode: 412 })), abort: vi.fn() }); await call('confirmSignature');
    expect(page!.data).toMatchObject({ checkedPreview: false, busy: false }); expect(m.confirmSignature).toHaveBeenCalledTimes(1); expect(m.contract).toHaveBeenCalledTimes(2);
});
test('confirmed response only navigates after canonical contract and artifact readback', async () => {
    await mount(true); checkPreview(); const signed = { ...contract(true), status: 'SUCCEEDED', tenant_signature: { name: '张三', account_id: 'tenant', status: 'SUCCEEDED', signed_at: '2026-10-09T12:00:00Z' }, current_attempt: { ...attempt(), status: 'CONFIRMED', allowed_actions: [] }, final_artifact: artifact() };
    m.get.mockReturnValue(record({ ...order(), order: { ...order().order, stage: 'PREPARING' } }));
    m.contract.mockReturnValue(record(signed, '"CONTRACT:c1:2"')); m.signature.mockReturnValue(record({ state: 'FOUND', attempt: signed.current_attempt })); await call('confirmSignature');
    expect(page!.data).toMatchObject({ statusTitle: '合同已签署', canConfirm: false, busy: false }); expect(wx.redirectTo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ url: '/pages/confirm/index?orderId=o1' }));
});

test.each(['recover', 'upload', 'identity'] as const)('failed refresh withdraws the previous %s action without losing its stored intent', async kind => {
    if (kind === 'recover') { m.pendingSignature.mockReturnValue({ body: { client_signature_id: 'signature-original-1' } }); m.signature.mockReturnValue(record({ state: 'NOT_FOUND', attempt: null })); }
    if (kind === 'upload') m.draftRead.mockReturnValue({ create: { client_signature_id: 'signature-original-1' } });
    await mount();
    if (kind === 'identity') { m.contract.mockReturnValue(record({ ...contract(), blockers: [{ code: 'REAL_NAME_REQUIRED' }], allowed_actions: [] })); await call('refresh'); }
    const flag = kind === 'recover' ? 'recoverCreate' : kind === 'upload' ? 'hasUpload' : 'requiresIdentity';
    expect(page!.data[flag]).toBe(true);
    m.contract.mockReturnValueOnce({ promise: Promise.reject(new Error('合同重查失败')), abort: vi.fn() });
    await call('refresh');
    m.recoverSignature.mockReturnValue(record(attempt()));
    await call('recover'); call('sign'); call('goIdentity');
    expect(m.recoverSignature).not.toHaveBeenCalled(); expect(wx.navigateTo).not.toHaveBeenCalled();
    expect(page!.data).toMatchObject({ loaded: false, recoverCreate: false, hasUpload: false, requiresIdentity: false, errorText: '合同重查失败' });
    expect(m.forget).not.toHaveBeenCalled();
});

test('an unavailable contract cannot open an old preview or download after read failure', async () => {
    await mount(true); checkPreview();
    m.contract.mockReturnValueOnce({ promise: Promise.reject(new Error('合同已不可读取')), abort: vi.fn() });
    await call('refresh'); m.download.mockReturnValue({ promise: Promise.resolve('/tmp/old.pdf'), abort: vi.fn() });
    call('previewAll'); await call('download');
    expect(wx.previewImage).not.toHaveBeenCalled(); expect(m.download).not.toHaveBeenCalled();
    expect(page!.data).toMatchObject({ loaded: false, artifactId: '', checkedPreview: false, previewLoaded: false });
});

test('a download completed after a newer contract read cannot open the superseded document', async () => {
    await mount(true); const file = deferred(); m.download.mockReturnValue(file); const downloading = call('download'); await tick();
    m.contract.mockReturnValue(record(contract(), '"CONTRACT:c1:3"')); await call('refresh');
    file.resolve('/tmp/old.pdf'); await downloading;
    expect(wx.openDocument).not.toHaveBeenCalled();
});

test('preview acknowledgement cannot change after account ownership changes', async () => {
    await mount(true); call('previewLoaded', { currentTarget: { dataset: { artifact: 'artifact-1' } } }); m.owner = 'other';
    call('togglePreview'); expect(page!.data['checkedPreview']).toBe(false);
});

test.each(['missing-artifact', 'unsigned-tenant', 'invalid-signed-at', 'other-order'] as const)('incomplete signed readback is not displayed as a saved contract: %s', async invalid => {
    await mount(true);
    const signed = { ...contract(true), status: 'SUCCEEDED', tenant_signature: { name: '张三', account_id: 'tenant', status: 'SUCCEEDED', signed_at: '2026-10-09T12:00:00Z' }, current_attempt: { ...attempt(), status: 'CONFIRMED', allowed_actions: [] }, final_artifact: invalid === 'missing-artifact' ? null : artifact() };
    if (invalid === 'unsigned-tenant') signed.tenant_signature.status = 'PENDING';
    if (invalid === 'invalid-signed-at') signed.tenant_signature.signed_at = 'invalid';
    if (invalid === 'other-order') m.get.mockReturnValue(record({ ...order(), order: { ...order().order, order_id: 'another-order' } }));
    m.contract.mockReturnValue(record(signed, '"CONTRACT:c1:2"')); m.signature.mockReturnValue(record({ state: 'FOUND', attempt: signed.current_attempt }));
    await call('refresh');
    expect(page!.data).toMatchObject({ loaded: false, canConfirm: false, artifactId: '' });
    expect(page!.data['statusTitle']).not.toBe('合同已签署'); expect(wx.redirectTo).not.toHaveBeenCalled();
});

test('signed read-only view never resumes a leftover upload draft', async () => {
    await mount(true);
    const signed = { ...contract(true), status: 'SUCCEEDED', tenant_signature: { name: '张三', account_id: 'tenant', status: 'SUCCEEDED', signed_at: '2026-10-09T12:00:00Z' }, current_attempt: { ...attempt(), status: 'CONFIRMED', allowed_actions: [] }, final_artifact: artifact() };
    m.draftRead.mockReturnValue({ create: { client_signature_id: 'different-old-draft' } });
    m.get.mockReturnValue(record({ ...order(), order: { ...order().order, stage: 'PREPARING' } }));
    m.contract.mockReturnValue(record(signed, '"CONTRACT:c1:2"')); m.signature.mockReturnValue(record({ state: 'FOUND', attempt: signed.current_attempt }));
    await call('refresh'); call('sign');
    expect(page!.data).toMatchObject({ loaded: true, tenantStatus: '已签署', hasUpload: false, canSign: false, canRewrite: false });
    expect(wx.navigateTo).not.toHaveBeenCalled(); expect(m.forget).not.toHaveBeenCalled();
    call('continueOrder'); expect(wx.redirectTo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ url: '/pages/order-detail/index?orderId=o1' }));
});

test('return during signature recovery opens the original order detail, not checkout', async () => {
    m.pendingSignature.mockReturnValue({ body: { client_signature_id: 'signature-original-1' } }); m.signature.mockReturnValue(record({ state: 'NOT_FOUND', attempt: null }));
    m.get.mockReturnValue(record({ ...order(), order: { ...order().order, stage: 'PREPARING' } }));
    await mount(); call('continueOrder');
    expect(wx.redirectTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/order-detail/index?orderId=o1' }));
    expect(m.recoverSignature).not.toHaveBeenCalled();
});

test('an in-flight recheck cannot recover a signature, and a successful recheck restores only its original explicit action', async () => {
    m.pendingSignature.mockReturnValue({ body: { client_signature_id: 'signature-original-1' } }); m.signature.mockReturnValue(record({ state: 'NOT_FOUND', attempt: null }));
    await mount(); const pending = deferred(); m.contract.mockReturnValueOnce(pending); const reading = call('refresh'); await tick();
    m.recoverSignature.mockReturnValue(record(attempt())); await call('recover'); expect(m.recoverSignature).not.toHaveBeenCalled();
    pending.resolve({ value: contract(), etag: '"CONTRACT:c1:1"' }); await reading;
    expect(page!.data['recoverCreate']).toBe(true); expect(m.recoverSignature).not.toHaveBeenCalled();
    await call('recover'); expect(m.recoverSignature).toHaveBeenCalledExactlyOnceWith('o1');
});

test('current full preview and PDF open only the verified artifact without confirming it', async () => {
    await mount(true); m.download.mockReturnValue({ promise: Promise.resolve('/tmp/current.pdf'), abort: vi.fn() });
    call('previewAll'); await call('download');
    expect(wx.previewImage).toHaveBeenCalledExactlyOnceWith({ current: url + '1.png', urls: [url + '1.png', url + '2.png'] });
    expect(m.download).toHaveBeenCalledExactlyOnceWith(url + '.pdf'); expect(wx.openDocument).toHaveBeenCalledWith(expect.objectContaining({ filePath: '/tmp/current.pdf', fileType: 'pdf', showMenu: true }));
    expect(m.confirmSignature).not.toHaveBeenCalled(); expect(page!.data['checkedPreview']).toBe(false);
});

const failedAttempt = () => ({ ...attempt(), status: 'RENDER_FAILED', preview_artifact_id: null, preview_sha256: null, error_code: 'CONTRACT_RENDER_FAILED', allowed_actions: [action('RETRY_CONTRACT_RENDER'), action('REWRITE_SIGNATURE')] });
const savedSignature = () => ({ material_id: 'ink-original', sha256: 'e'.repeat(64), url: url + '-signature.png' });
async function showRenderFailure() {
    await mount();
    m.contract.mockReturnValue(record({ ...contract(), current_attempt: failedAttempt(), allowed_actions: [] }));
    m.signature.mockReturnValue(record({ state: 'FOUND', attempt: failedAttempt(), signature_image: savedSignature() }, '"SIGNATURE_ATTEMPT:attempt-1:2"'));
    await call('refresh');
}
test('render failure shows the saved OSS signature and retries the same attempt without opening a new canvas', async () => {
    await showRenderFailure();
    expect(page!.data).toMatchObject({ renderFailed: true, signatureImageURL: savedSignature().url, signatureImageID: 'ink-original', canRetry: true, canRewrite: false, canSign: false, canConfirm: false });
    call('sign'); expect(wx.navigateTo).not.toHaveBeenCalled();
    call('previewSignature'); expect(wx.previewImage).toHaveBeenCalledExactlyOnceWith({ current: savedSignature().url, urls: [savedSignature().url] });
    m.retrySignatureRender.mockReturnValue(record({ ...failedAttempt(), status: 'BUILDING' }));
    await call('retryRender');
    expect(m.retrySignatureRender).toHaveBeenCalledExactlyOnceWith('o1', 'signature-original-1', '"SIGNATURE_ATTEMPT:attempt-1:2"');
    expect(m.confirmSignature).not.toHaveBeenCalled(); expect(m.agree).not.toHaveBeenCalled();
});
test.each(['missing', 'external', 'invalid-hash'])('render failure rejects an unverifiable signature image: %s', async kind => {
    await showRenderFailure();
    const signature_image = kind === 'missing' ? null : { ...savedSignature(), ...(kind === 'external' ? { url: 'https://other.invalid/signature.png' } : { sha256: 'bad' }) };
    m.signature.mockReturnValue(record({ state: 'FOUND', attempt: failedAttempt(), signature_image }));
    await call('refresh'); await call('retryRender'); call('previewSignature');
    expect(page!.data).toMatchObject({ loaded: false, canRetry: false, signatureImageURL: '', errorText: expect.stringContaining('签名图片') });
    expect(wx.previewImage).not.toHaveBeenCalled(); expect(m.retrySignatureRender).not.toHaveBeenCalled();
});
test('signature image failure and stale image events cannot authorize or change another page', async () => {
    await showRenderFailure();
    call('signatureImageFailed', { currentTarget: { dataset: { signature: 'ink-original' } } });
    expect(page!.data).toMatchObject({ signatureImageFailed: true, canConfirm: false });
    call('onHide'); const hidden = structuredClone(page!.data);
    call('signatureImageFailed', { currentTarget: { dataset: { signature: 'ink-original' } } }); call('previewSignature');
    expect(page!.data).toEqual(hidden); expect(wx.previewImage).not.toHaveBeenCalled();
});
test('an unknown render retry reads its original result and never offers a replacement signature', async () => {
    await showRenderFailure();
    m.retrySignatureRender.mockImplementationOnce(() => { m.pendingSignatureRender.mockReturnValue({ body: {}, etag: '"SIGNATURE_ATTEMPT:attempt-1:2"' }); return { promise: Promise.reject(new Error('网络超时，结果待核实')), abort: vi.fn() }; });
    const beforeReads = m.contract.mock.calls.length;
    await call('retryRender');
    expect(m.contract.mock.calls.length).toBe(beforeReads + 1);
    expect(page!.data).toMatchObject({ resultPending: true, unknown: true, recoverRender: true, canRewrite: false, canSign: false, renderFailed: false });
    expect(m.retrySignatureRender).toHaveBeenCalledTimes(1); expect(m.agree).not.toHaveBeenCalled();
});
test('an expired pending contract withdraws saved uploads and recovery without claiming order closure', async () => {
    m.pendingSignature.mockReturnValue({ body: { client_signature_id: 'signature-original-1' } });
    m.signature.mockReturnValue(record({ state: 'NOT_FOUND', attempt: null, signature_image: null }));
    m.draftRead.mockReturnValue({ create: { client_signature_id: 'signature-original-1' } });
    await mount();
    m.contract.mockReturnValue(record({ ...contract(), blockers: [{ code: 'CONTRACT_EXPIRED', message: '本次签约已不可继续' }], allowed_actions: [action('SIGN_CONTRACT', false)] }));
    await call('refresh'); call('sign'); await call('recover');
    expect(page!.data).toMatchObject({ loaded: true, statusTitle: '本次签约不可继续', deadline: '', hasUpload: false, recoverCreate: false, canRetry: false, canSign: false, canConfirm: false, canRewrite: false, resultPending: false });
    expect(m.recoverSignature).not.toHaveBeenCalled(); expect(wx.navigateTo).not.toHaveBeenCalled(); expect(m.forget).not.toHaveBeenCalled();
    call('continueOrder'); expect(wx.redirectTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/order-detail/index?orderId=o1' }));
});
