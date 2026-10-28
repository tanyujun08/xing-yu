import { accountApi } from '../../shared/api/account-api';
import { rentalOrderApi, rentalSignatureDrafts, downloadRentalContract, type RentalContract, type RentalRecord, type RentalContractArtifact, type RentalSignature } from '../../shared/api/rental-api';
import { createRentalPageState } from '../../shared/interaction/rental-page-state';
import { navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { beijingTime, rentalDateRange, rentalMoney, rentalBlockers, rentalActionAllowed } from '../../shared/presentation/rental-order';
import { signatureStatus, signatureUnavailable, validContractArtifact, validSignatureImage } from '../../shared/presentation/contract-signature';
import { designAssets } from '../../shared/design/assets';

function newState() { return { ...createRentalPageState<RentalRecord<RentalContract>>(), readEpoch: 0, orderTarget: 'order-detail', attempt: null as RentalRecord<RentalSignature> | null, artifact: null as RentalContractArtifact | null }; }
const states = new WeakMap<object, ReturnType<typeof newState>>();
function state(page: object) { let s = states.get(page); if (!s) { s = newState(); states.set(page, s); } return s; }
const empty = { loaded: false, canSign: false, canConfirm: false, canRewrite: false, canRetry: false, unknown: false, recoverCreate: false, recoverConfirm: false, recoverRender: false, hasUpload: false, requiresIdentity: false, artifactId: '', previewURL: '', previewLoaded: false, agreed: false, fullText: false, checkedPreview: false, resultPending: false, lastChecked: '', statusIcon: '', renderFailed: false, signatureImageURL: '', signatureImageID: '', signatureImageFailed: false };

Page({
    data: { ...empty, loading: false, busy: false, errorText: '', heading: '租赁合同', statusTitle: '', statusHint: '', tone: 'neutral', title: '', image: '', term: '', rent: '', deposit: '', total: '', orderNo: '', deadline: '', lessorName: '', tenantName: '', tenantStatus: '', signedAt: '', agreementText: '', fullText: false, blockers: '', pageCount: 0, signaturePage: 0, checkIcon: designAssets.agreementCheck, signatureIcon: designAssets.orderSignature },
    onLoad(options: Record<string, string | undefined>) { state(this).id = options['orderId'] ?? ''; },
    onShow() { state(this).show(accountApi.sessionIdentity() ?? ''); void this.refresh(); },
    onHide() { state(this).hide(); this.setData({ ...empty, loading: false, busy: false, agreementText: '', lessorName: '', tenantName: '', fullText: false }); },
    onUnload() { state(this).dispose(); },
    clearSession() { const s = state(this); s.current = null; s.artifact = null; s.attempt = null; this.setData({ ...empty, loading: false, busy: false, agreementText: '', title: '', orderNo: '', lessorName: '', tenantName: '', errorText: '登录状态已变化，请重新登录后读取本人合同' }); },
    async refresh() {
        const s = state(this), readEpoch = ++s.readEpoch, lease = s.capture(accountApi.sessionIdentity), active = () => lease() && s.readEpoch === readEpoch;
        if (!active() || !s.owner || !s.id) { this.clearSession(); return; }
        const previous = s.current, priorArtifactId = s.artifact?.artifact_id, reading = { agreed: this.data.agreed, fullText: this.data.fullText };
        s.current = null; s.attempt = null; s.artifact = null;
        this.setData({ ...empty, loading: true, errorText: '', statusTitle: '', tenantStatus: '' });
        try {
            const pending = rentalOrderApi.pendingSignature(s.id);
            const original = pending ? await rentalOrderApi.signature(s.id, pending.body.client_signature_id).promise : null;
            if (!active()) return;
            const [record, order] = await Promise.all([rentalOrderApi.contract(s.id).promise, rentalOrderApi.get(s.id).promise]);
            if (!active()) return;
            const v = record.value, attempt = v.current_attempt;
            if (v.order_id !== s.id || order.value.order.order_id !== s.id || !v.agreement_text || !/^[a-f0-9]{64}$/.test(v.agreement_sha256) || !/^[a-f0-9]{64}$/.test(v.order_terms_sha256)) throw new Error('合同快照不可用，请重新查询');
            if (v.status === 'SUCCEEDED' && (v.tenant_signature.status !== 'SUCCEEDED' || !v.tenant_signature.signed_at || !Number.isFinite(Date.parse(v.tenant_signature.signed_at)) || !v.final_artifact || !validContractArtifact(v.final_artifact))) throw new Error('已签合同信息不完整，请重新读取');
            let attemptRecord: RentalRecord<RentalSignature> | null = null;
            let signatureImageURL = '', signatureImageID = '';
            if (attempt) {
                const lookup = await rentalOrderApi.signature(s.id, attempt.client_signature_id).promise;
                if (!active()) return;
                if (lookup.value.state !== 'FOUND' || !lookup.value.attempt || lookup.value.attempt.attempt_id !== attempt.attempt_id || lookup.value.attempt.client_signature_id !== attempt.client_signature_id || lookup.value.attempt.version !== attempt.version || lookup.value.attempt.status !== attempt.status) throw new Error('签名状态已更新，请重新查询');
                attemptRecord = { value: lookup.value.attempt, etag: lookup.etag };
                if (attempt.status === 'RENDER_FAILED' && !signatureUnavailable(v)) {
                    if (!validSignatureImage(lookup.value.signature_image)) throw new Error('原签名图片不可用，请重新查询');
                    signatureImageURL = lookup.value.signature_image.url; signatureImageID = lookup.value.signature_image.material_id;
                }
            }
            const unresolved = original?.value.state === 'NOT_FOUND', pendingConfirm = attempt ? rentalOrderApi.pendingSignatureConfirmation(s.id, attempt.client_signature_id) : null;
            const pendingRender = attempt ? rentalOrderApi.pendingSignatureRender(s.id, attempt.client_signature_id) : null;
            const artifact = v.final_artifact ?? (attempt?.status === 'PREVIEW_READY' && attempt.preview_artifact_id ? (await rentalOrderApi.contractArtifact(s.id, attempt.preview_artifact_id).promise).value : null);
            if (!active()) return;
            if (artifact && (!validContractArtifact(artifact) || attempt && (artifact.artifact_id !== attempt.preview_artifact_id || artifact.document_sha256 !== attempt.preview_sha256))) throw new Error('合同预览与签名不匹配，请重新查询');
            const changed = previous?.etag !== record.etag || previous?.value.agreement_sha256 !== v.agreement_sha256 || previous?.value.order_terms_sha256 !== v.order_terms_sha256 || previous?.value.agreement_text !== v.agreement_text || priorArtifactId !== artifact?.artifact_id;
            s.current = record; s.artifact = artifact; s.attempt = attemptRecord;
            s.orderTarget = v.status === 'SUCCEEDED' && order.value.order.stage === 'PREPARING' && v.tenant_signature.account_id === s.owner ? 'confirm' : 'order-detail';
            const unavailable = signatureUnavailable(v), pendingTenant = v.status === 'PENDING' && v.tenant_signature.account_id === s.owner && !unavailable;
            const status = signatureStatus(v, !!unresolved || !!pendingConfirm || !!pendingRender), upload = pendingTenant ? rentalSignatureDrafts.read(s.id) : null;
            if (upload && (original?.value.attempt?.client_signature_id === upload.create.client_signature_id || attempt?.client_signature_id === upload.create.client_signature_id)) rentalSignatureDrafts.forgetAccepted(upload);
            if (v.tenant_signature.account_id !== s.owner && v.status === 'PENDING' && !unavailable) { status.title = '待承租人签署'; status.hint = '出租方默认已签署，等待承租人完成签名确认。'; status.tone = 'neutral'; }
            const hasUpload = pendingTenant && !!rentalSignatureDrafts.read(s.id), signaturePage = artifact?.anchor_snapshot_json[0]?.page_no ?? 0;
            const actions = attempt?.allowed_actions ?? [];
            const confirmBody = pendingConfirm?.body;
            const matchingConfirmation = !!artifact && !!confirmBody && 'preview_artifact_id' in confirmBody && 'preview_sha256' in confirmBody && 'accepted' in confirmBody && confirmBody.preview_artifact_id === artifact.artifact_id && confirmBody.preview_sha256 === artifact.document_sha256 && confirmBody.accepted === true;
            const canConfirm = pendingTenant && !!artifact && !unresolved && !pendingRender && (!pendingConfirm || matchingConfirmation) && rentalActionAllowed(actions, 'CONFIRM_SIGNATURE');
            const recoverConfirm = !!pendingConfirm && canConfirm;
            if (recoverConfirm) status.hint = '请核对原合同与本人签名，再重试本次确认。不会生成新的签名或合同。';
            const resultPending = pendingTenant && (!!unresolved || !!pendingRender || !canConfirm && (!!pendingConfirm || attempt?.status === 'BUILDING'));
            const renderFailed = pendingTenant && attempt?.status === 'RENDER_FAILED' && !resultPending;
            this.setData({
                loaded: true, heading: v.status === 'SUCCEEDED' ? '已签合同' : resultPending || renderFailed ? '合同签署' : artifact ? '签名预览' : '租赁合同', statusTitle: status.title, statusHint: status.hint, tone: status.tone,
                resultPending, renderFailed, signatureImageURL, signatureImageID, lastChecked: beijingTime(new Date().toISOString()), statusIcon: v.status === 'SUCCEEDED' ? designAssets.returnSuccess : resultPending || renderFailed ? designAssets.contractPending : artifact ? designAssets.contractPreview : pendingTenant && !attempt ? designAssets.orderSignature : '',
                title: order.value.order.asset.title, image: order.value.order.asset.cover_media?.url ?? '', term: rentalDateRange(order.value.order.rental_start_at, order.value.order.rental_end_at),
                rent: rentalMoney(String(BigInt(order.value.fees.rent_gross_fen) - BigInt(order.value.fees.rent_discount_fen))), deposit: rentalMoney(order.value.fees.deposit_due_fen), total: rentalMoney(order.value.fees.initial_due_fen),
                orderNo: order.value.order.order_no, deadline: v.status === 'PENDING' && !unavailable ? beijingTime(v.expires_at) : '', lessorName: v.lessor_signature.name, tenantName: v.tenant_signature.name,
                tenantStatus: v.tenant_signature.status === 'SUCCEEDED' ? '已签署' : '待签署', signedAt: v.tenant_signature.signed_at ? beijingTime(v.tenant_signature.signed_at) : '', agreementText: v.agreement_text, blockers: rentalBlockers(v.blockers),
                unknown: !!unresolved || !!pendingConfirm || !!pendingRender, recoverCreate: pendingTenant && !!unresolved, recoverRender: pendingTenant && !!pendingRender, hasUpload, requiresIdentity: pendingTenant && v.blockers.some(b => b.code === 'REAL_NAME_REQUIRED'),
                canSign: pendingTenant && !unresolved && !hasUpload && !attempt && rentalActionAllowed(v.allowed_actions, 'SIGN_CONTRACT'), canConfirm, recoverConfirm,
                canRewrite: pendingTenant && !unresolved && !pendingConfirm && !pendingRender && !hasUpload && attempt?.status !== 'RENDER_FAILED' && rentalActionAllowed(actions, 'REWRITE_SIGNATURE'), canRetry: pendingTenant && !unresolved && !pendingConfirm && rentalActionAllowed(actions, 'RETRY_CONTRACT_RENDER'),
                artifactId: artifact?.artifact_id ?? '', previewURL: artifact?.pages[signaturePage - 1]?.url ?? '', pageCount: artifact?.page_count ?? 0, signaturePage,
            });
            if (!changed) this.setData(reading);
        } catch (error) { if (active()) { s.current = null; s.artifact = null; s.attempt = null; this.setData({ ...empty, statusTitle: '', tenantStatus: '', agreementText: '', errorText: error instanceof Error ? error.message : '合同读取失败，请重试' }); } }
        finally { if (active()) this.setData({ loading: false }); else if (s.visible && accountApi.sessionIdentity() !== s.owner) this.clearSession(); }
    },
    toggleAgree() { if (state(this).capture(accountApi.sessionIdentity)() && this.data.loaded && this.data.canSign && this.data.fullText && !this.data.loading && !this.data.busy) this.setData({ agreed: !this.data.agreed }); },
    togglePreview() { if (state(this).capture(accountApi.sessionIdentity)() && this.data.loaded && !this.data.loading && this.data.canConfirm && !this.data.busy && this.data.previewLoaded) this.setData({ checkedPreview: !this.data.checkedPreview }); },
    toggleText() { if (state(this).capture(accountApi.sessionIdentity)() && this.data.loaded && !this.data.loading && !this.data.busy) this.setData({ fullText: !this.data.fullText, agreed: false }); },
    sign() {
        const s = state(this); if (!s.capture(accountApi.sessionIdentity)() || this.data.busy || this.data.loading || !s.current || !(this.data.hasUpload || this.data.canRewrite || this.data.canSign && this.data.fullText && this.data.agreed)) return;
        if (!this.data.hasUpload) rentalSignatureDrafts.agree(s.id, s.current.value);
        s.navigation.navigateOnce('signature', callbacks => wx.navigateTo({ url: '/pages/contract-sign/index?orderId=' + encodeURIComponent(s.id), ...callbacks }));
    },
    previewLoaded(event: WechatMiniprogram.CustomEvent<Record<string, unknown>, { artifact: string }>) { if (state(this).capture(accountApi.sessionIdentity)() && this.data.loaded && !this.data.loading && this.data.artifactId && event.currentTarget.dataset.artifact === this.data.artifactId) this.setData({ previewLoaded: true }); },
    previewFailed(event: WechatMiniprogram.CustomEvent<Record<string, unknown>, { artifact: string }>) { if (state(this).capture(accountApi.sessionIdentity)() && this.data.loaded && !this.data.loading && this.data.artifactId && event.currentTarget.dataset.artifact === this.data.artifactId) this.setData({ previewLoaded: false, checkedPreview: false, errorText: '合同页面加载失败，请重新查询后核对' }); },
    previewAll() { const s = state(this); if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded || this.data.loading || this.data.busy || !s.artifact) return; wx.previewImage({ current: s.artifact.pages[0]!.url, urls: s.artifact.pages.map(p => p.url) }); },
    signatureImageFailed(event: WechatMiniprogram.CustomEvent<Record<string, unknown>, { signature: string }>) { if (state(this).capture(accountApi.sessionIdentity)() && this.data.loaded && !this.data.loading && this.data.renderFailed && event.currentTarget.dataset.signature === this.data.signatureImageID) this.setData({ signatureImageFailed: true }); },
    previewSignature() { const s = state(this); if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded || this.data.loading || this.data.busy || !this.data.renderFailed || !this.data.signatureImageURL || this.data.signatureImageFailed) return; wx.previewImage({ current: this.data.signatureImageURL, urls: [this.data.signatureImageURL] }); },
    async confirmSignature() {
        const s = state(this); await s.run('signature-command', async () => {
            const active = s.capture(accountApi.sessionIdentity), a = s.attempt, artifact = s.artifact;
            if (!active() || !this.data.loaded || this.data.loading || this.data.busy || !a || !artifact || !this.data.canConfirm || !this.data.checkedPreview || !this.data.previewLoaded) return;
            this.setData({ busy: true, errorText: '' });
            try {
                await rentalOrderApi.confirmSignature(s.id, a.value.client_signature_id, { preview_artifact_id: artifact.artifact_id, preview_sha256: artifact.document_sha256, accepted: true }, a.etag).promise;
                if (active()) {
                    await this.refresh();
                    if (active() && s.current?.value.status === 'SUCCEEDED') s.navigation.navigateOnce('order', callbacks => wx.redirectTo({ url: '/pages/' + s.orderTarget + '/index?orderId=' + encodeURIComponent(s.id), ...callbacks }));
                }
            }
            catch (error) { if (active()) { await this.refresh(); if (active()) this.setData({ checkedPreview: false, errorText: error instanceof Error ? error.message : '签署结果待核实，请查询原请求' }); } }
            finally { if (active()) this.setData({ busy: false }); else if (s.visible && accountApi.sessionIdentity() !== s.owner) this.clearSession(); }
        });
    },
    async recover() {
        const s = state(this); await s.run('signature-command', async () => {
            const active = s.capture(accountApi.sessionIdentity); if (!active() || !this.data.loaded || this.data.loading || this.data.busy || !this.data.recoverCreate) return;
            this.setData({ busy: true, errorText: '' });
            try { await rentalOrderApi.recoverSignature(s.id).promise; if (active()) await this.refresh(); }
            catch (error) { if (active()) this.setData({ errorText: error instanceof Error ? error.message : '原请求仍待核实' }); }
            finally { if (active()) this.setData({ busy: false }); else if (s.visible && accountApi.sessionIdentity() !== s.owner) this.clearSession(); }
        });
    },
    async retryRender() {
        const s = state(this); await s.run('signature-command', async () => {
            const active = s.capture(accountApi.sessionIdentity), a = s.attempt; if (!active() || !this.data.loaded || this.data.loading || this.data.busy || !a || !this.data.canRetry) return;
            this.setData({ busy: true, errorText: '' });
            try { await rentalOrderApi.retrySignatureRender(s.id, a.value.client_signature_id, a.etag).promise; if (active()) await this.refresh(); }
            catch (error) { if (active()) { await this.refresh(); if (active()) this.setData({ errorText: error instanceof Error ? error.message : '生成结果待核实，请查询原请求' }); } }
            finally { if (active()) this.setData({ busy: false }); else if (s.visible && accountApi.sessionIdentity() !== s.owner) this.clearSession(); }
        });
    },
    async download() {
        const s = state(this); await s.run('contract-download', async () => {
            const lease = s.capture(accountApi.sessionIdentity), readEpoch = s.readEpoch, active = () => lease() && readEpoch === s.readEpoch;
            if (!active() || !this.data.loaded || this.data.loading || this.data.busy || !s.artifact) return;
            this.setData({ busy: true, errorText: '' });
            const file = downloadRentalContract(s.artifact.document_url), release = s.scope.registerCleanup(file.abort);
            try { const filePath = await file.promise; if (active()) wx.openDocument({ filePath, fileType: 'pdf', showMenu: true, fail: () => { if (active()) this.setData({ errorText: '无法打开合同文件，请重试' }); } }); }
            catch { if (active()) this.setData({ errorText: '合同下载失败，请重试' }); }
            finally { release(); if (lease()) this.setData({ busy: false }); else if (s.visible && accountApi.sessionIdentity() !== s.owner) this.clearSession(); }
        });
    },
    goIdentity() { const s = state(this); if (s.capture(accountApi.sessionIdentity)() && this.data.loaded && !this.data.loading && !this.data.busy && this.data.requiresIdentity) s.navigation.navigateOnce('identity', callbacks => wx.navigateTo({ url: '/pages/identity/index', ...callbacks })); },
    continueOrder() { const s = state(this); if (s.capture(accountApi.sessionIdentity)()) s.navigation.navigateOnce('order', callbacks => wx.redirectTo({ url: '/pages/order-detail/index?orderId=' + encodeURIComponent(s.id), ...callbacks })); },
    backToOrders() { const s = state(this); if (!this.data.busy && s.visible && !s.scope.disposed) s.navigation.navigateOnce('orders', callbacks => wx.switchTab({ url: '/pages/orders/index', ...callbacks })); },
    onSecondaryNavigationBack() { navigateBackWithFallback(state(this).navigation); },
demoSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
});
