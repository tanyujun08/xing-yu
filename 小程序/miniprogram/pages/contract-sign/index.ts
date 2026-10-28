import { accountApi } from '../../shared/api/account-api';
import { rentalOrderApi, rentalSignatureDrafts, submitRentalSignature, type RentalRecord, type RentalContract, type SignatureUploadDraft } from '../../shared/api/rental-api';
import { createRentalPageState } from '../../shared/interaction/rental-page-state';
import { createOperationScope } from '../../shared/interaction/operation-scope';
import { createNavigateOnce } from '../../shared/interaction/navigate-once';
import { signatureStrokeQuality, type SignaturePoint, type SignatureStroke } from '../../shared/model/contract-signature';
import { rentalActionAllowed } from '../../shared/presentation/rental-order';
import { designAssets } from '../../shared/design/assets';

function newState() { return { ...createRentalPageState<RentalRecord<RentalContract>>(createOperationScope(), createNavigateOnce()), strokes: [] as SignatureStroke[], drawing: false, canvas: null as WechatMiniprogram.Canvas | null, context: null as WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D | null, width: 0, height: 0, draft: null as SignatureUploadDraft | null }; }
const states = new WeakMap<object, ReturnType<typeof newState>>();
function state(page: object) { let s = states.get(page); if (!s) { s = newState(); states.set(page, s); } return s; }
function point(event: WechatMiniprogram.TouchCanvas, s: ReturnType<typeof newState>): SignaturePoint | null { const p = event.touches[0]; return p && s.width > 0 && s.height > 0 ? { x: Math.max(0, Math.min(1, p.x / s.width)), y: Math.max(0, Math.min(1, p.y / s.height)) } : null; }
function redraw(s: ReturnType<typeof newState>) {
    const ctx = s.context; if (!ctx) return;
    ctx.clearRect(0, 0, s.width, s.height); ctx.strokeStyle = '#111111'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const stroke of s.strokes) { if (stroke.length < 2) continue; ctx.beginPath(); ctx.moveTo(stroke[0]!.x * s.width, stroke[0]!.y * s.height); for (const p of stroke.slice(1)) ctx.lineTo(p.x * s.width, p.y * s.height); ctx.stroke(); }
}

Page({
    data: { loading: true, ready: false, busy: false, leaveDialog: false, name: '', hasInk: false, validInk: false, hasDraft: false, rejected: false, errorText: '', progressText: '', signatureIcon: designAssets.orderSignature, undoIcon: designAssets.signatureUndo, clearIcon: designAssets.signatureClear },
    onLoad(options: Record<string, string | undefined>) { state(this).id = options['orderId'] ?? ''; },
    onShow() { const s = state(this), account = accountApi.sessionIdentity() ?? ''; if (account !== s.owner) { s.strokes = []; s.draft = null; } s.show(account); void this.load(); },
    onHide() { const s = state(this); s.drawing = false; s.hide(); this.setData({ ready: false, busy: false, leaveDialog: false, name: '' }); },
    onUnload() { const s = state(this); s.strokes = []; s.context = null; s.canvas = null; s.dispose(); },
    onResize() { if (this.data.ready) this.initializeCanvas(); },
    clearSession() { const s = state(this); s.strokes = []; s.drawing = false; s.draft = null; s.current = null; redraw(s); wx.disableAlertBeforeUnload(); this.setData({ loading: false, busy: false, ready: false, name: '', hasInk: false, validInk: false, hasDraft: false, progressText: '', errorText: '登录状态已变化，请重新登录后打开本人合同' }); },
    async load() {
        const s = state(this), active = s.capture(accountApi.sessionIdentity); this.setData({ loading: true, errorText: '', ready: false });
        try {
            if (!s.owner || !s.id) throw new Error('请登录后从订单打开合同');
            const record = await rentalOrderApi.contract(s.id).promise; if (!active()) return;
            s.current = record; s.draft = rentalSignatureDrafts.read(s.id);
            if (record.value.tenant_signature.account_id !== s.owner) throw new Error('仅承租人可在此签名');
            const attempt = record.value.current_attempt, allowed = attempt ? rentalActionAllowed(attempt.allowed_actions, 'REWRITE_SIGNATURE') : rentalActionAllowed(record.value.allowed_actions, 'SIGN_CONTRACT');
            if (!s.draft && rentalOrderApi.pendingSignature(s.id)) throw new Error('原签名结果待核实，请返回合同查询');
            if (!s.draft && (!allowed || !rentalSignatureDrafts.hasAgreement(s.id, record.value))) throw new Error('请返回合同，阅读并同意当前内容后签名');
            this.setData({ ready: !s.draft, name: record.value.tenant_signature.name, hasDraft: !!s.draft, rejected: s.draft?.upload.phase === 'FAILED' || !!s.draft?.failure, hasInk: s.strokes.length > 0, progressText: s.draft ? '原签名上传已保留，请继续查询或恢复。' : '' }, () => { if (active() && !s.draft) this.initializeCanvas(); });
        } catch (error) { if (active()) this.setData({ errorText: error instanceof Error ? error.message : '合同读取失败，请返回合同重试' }); }
        finally { if (active()) this.setData({ loading: false }); else if (s.visible && accountApi.sessionIdentity() !== s.owner) this.clearSession(); }
    },
    initializeCanvas() {
        const s = state(this), active = s.capture(accountApi.sessionIdentity);
        this.createSelectorQuery().select('#signature-canvas').fields({ node: true, size: true }).exec(results => {
            if (!active() || !this.data.ready) return;
            const result = results[0] as { node?: WechatMiniprogram.Canvas; width: number; height: number } | undefined;
            if (!result?.node || result.width <= 0 || result.height <= 0) { this.setData({ ready: false, errorText: '画板加载失败，请返回合同重试' }); return; }
            const dpr = wx.getWindowInfo().pixelRatio;
            s.canvas = result.node; s.width = result.width; s.height = result.height;
            s.canvas.width = Math.round(s.width * dpr); s.canvas.height = Math.round(s.height * dpr);
            s.context = s.canvas.getContext('2d'); s.context.scale(dpr, dpr); redraw(s); this.updateInk();
        });
    },
    startStroke(event: WechatMiniprogram.TouchCanvas) {
        const s = state(this); if (!this.data.ready || this.data.busy || event.touches.length !== 1 || !s.capture(accountApi.sessionIdentity)()) return;
        const p = point(event, s); if (!p) return; s.strokes.push([p]); s.drawing = true;
    },
    moveStroke(event: WechatMiniprogram.TouchCanvas) {
        const s = state(this); if (!s.drawing || this.data.busy || !s.capture(accountApi.sessionIdentity)()) return;
        if (event.touches.length !== 1) { this.endStroke(); return; }
        const p = point(event, s), stroke = s.strokes[s.strokes.length - 1]; if (!p || !stroke) return;
        if (stroke.length >= 2000 || s.strokes.length > 150) { this.endStroke(); this.setData({ errorText: '笔画较多，请清空后重新签写姓名' }); return; }
        stroke.push(p); redraw(s);
    },
    endStroke() { const s = state(this); s.drawing = false; this.updateInk(); },
    updateInk() { const s = state(this), hasInk = s.strokes.length > 0; this.setData({ hasInk, validInk: signatureStrokeQuality(s.strokes, s.width, s.height) }); if (hasInk) wx.enableAlertBeforeUnload({ message: '离开后未保存的签名将丢失' }); else wx.disableAlertBeforeUnload(); },
    undo() { const s = state(this); if (!this.data.ready || this.data.busy) return; s.drawing = false; s.strokes.pop(); redraw(s); this.updateInk(); },
    clear() { const s = state(this); if (!this.data.ready || this.data.busy) return; s.drawing = false; s.strokes = []; redraw(s); this.updateInk(); this.setData({ errorText: '' }); },
    async save() {
        const s = state(this); await s.run('save-signature', async () => {
            const active = s.capture(accountApi.sessionIdentity); if (!active() || !s.current || !s.canvas || !this.data.validInk || s.draft) return;
            this.setData({ busy: true, errorText: '', progressText: '正在保存签名…' });
            try {
                const canvas = s.canvas;
                const file = await new Promise<string>((resolve, reject) => wx.canvasToTempFilePath({ canvas, fileType: 'png', destWidth: canvas.width, destHeight: canvas.height, success: v => resolve(v.tempFilePath), fail: reject }, this));
                if (!active()) return;
                const size = await new Promise<number>((resolve, reject) => wx.getFileSystemManager().getFileInfo({ filePath: file, success: v => resolve(v.size), fail: reject }));
                if (!active()) return;
                if (size < 1 || size > 2 * 1024 * 1024) throw new Error('签名图片超过限制，请清空后重新签写');
                s.draft = await rentalSignatureDrafts.create(s.id, file, s.current, active);
                if (!active()) return;
                wx.disableAlertBeforeUnload(); this.setData({ hasDraft: true, ready: false }); await this.upload(false);
            } catch (error) { if (active()) this.setData({ errorText: error instanceof Error ? error.message : '签名保存失败，请重试' }); }
            finally { if (active()) this.setData({ busy: false }); else if (s.visible && accountApi.sessionIdentity() !== s.owner) this.clearSession(); }
        });
    },
    async resume() { const s = state(this); await s.run('save-signature', () => this.upload(true)); },
    async upload(recovery: boolean) {
        const s = state(this), active = s.capture(accountApi.sessionIdentity); if (!active() || !s.draft) return;
        this.setData({ busy: true, errorText: '' });
        try { const result = await submitRentalSignature(s.draft, { scope: s.scope, active, recovery, changed: (phase, progress) => { if (active()) this.setData({ progressText: phase === 'UPLOADING' ? '正在上传签名 ' + progress + '%' : phase === 'PROCESSING' ? '正在核验签名图片…' : '正在提交签名…' }); } }); if (active() && result) { s.strokes = []; s.draft = null; wx.disableAlertBeforeUnload(); this.returnContract(); } }
        catch (error) { if (active()) this.setData({ errorText: error instanceof Error ? error.message : '签名结果待核实，请恢复原请求', hasDraft: true, rejected: s.draft?.upload.phase === 'FAILED' || !!s.draft?.failure }); }
        finally { if (active()) this.setData({ busy: false }); else if (s.visible && accountApi.sessionIdentity() !== s.owner) this.clearSession(); }
    },
    discardRejected() { const s = state(this); if (!s.draft || this.data.busy) return; rentalSignatureDrafts.discardRejected(s.draft); s.draft = null; s.strokes = []; void this.load(); },
    back() {
        const s = state(this), active = s.capture(accountApi.sessionIdentity); if (!s.visible || s.scope.disposed || this.data.busy) return;
        if (!active()) { this.clearSession(); this.returnContract(); return; }
        if (!s.draft && s.strokes.length) { s.drawing = false; this.setData({ leaveDialog: true }); } else this.returnContract();
    },
    continueSigning() { const s = state(this); if (!s.visible || s.scope.disposed || this.data.busy || !this.data.leaveDialog) return; if (!s.capture(accountApi.sessionIdentity)()) { this.clearSession(); this.setData({ leaveDialog: false }); return; } this.setData({ leaveDialog: false }); },
    discardAndLeave() { const s = state(this); if (!s.visible || s.scope.disposed || this.data.busy || !this.data.leaveDialog) return; this.setData({ leaveDialog: false }); if (!s.capture(accountApi.sessionIdentity)()) { this.clearSession(); return; } s.strokes = []; s.drawing = false; redraw(s); this.updateInk(); this.returnContract(); },
    returnContract() { const s = state(this); if (!s.visible || s.scope.disposed) return; const pages = getCurrentPages(), previous = pages[pages.length - 2]; s.navigation.navigateOnce('contract', callbacks => previous?.route === 'pages/contract/index' && previous.options['orderId'] === s.id ? wx.navigateBack({ delta: 1, ...callbacks }) : wx.redirectTo({ url: '/pages/contract/index?orderId=' + encodeURIComponent(s.id), ...callbacks })); },
});


