import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const m = vi.hoisted(() => ({ owner: 'tenant' as string | null, contract: vi.fn(), pendingSignature: vi.fn(), draftRead: vi.fn(), hasAgreement: vi.fn(), submit: vi.fn() }));
vi.mock('../miniprogram/shared/api/account-api', () => ({ accountApi: { sessionIdentity: () => m.owner } }));
vi.mock('../miniprogram/shared/api/rental-api', () => ({ rentalOrderApi: { contract: m.contract, pendingSignature: m.pendingSignature }, rentalSignatureDrafts: { read: m.draftRead, hasAgreement: m.hasAgreement }, submitRentalSignature: m.submit }));

type Harness = { data: Record<string, unknown>; setData(patch: Record<string, unknown>, callback?: () => void): void; [key: string]: unknown };
let page: Harness | undefined;
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function call(name: string, ...args: unknown[]) { return (page![name] as (...args: unknown[]) => unknown).apply(page, args); }
async function mount() {
    let definition!: Harness; vi.stubGlobal('Page', (v: Harness) => definition = v);
    await import('../miniprogram/pages/contract-sign/index');
    const context = { clearRect: vi.fn(), scale: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() };
    const canvas = { width: 0, height: 0, getContext: () => context };
    const query = { select: () => query, fields: () => query, exec: (done: (rows: unknown[]) => void) => done([{ node: canvas, width: 300, height: 200 }]) };
    page = { ...definition, data: structuredClone(definition.data), setData(patch, callback) { Object.assign(this.data, patch); callback?.(); }, createSelectorQuery: () => query };
    call('onLoad', { orderId: 'o1' }); call('onShow'); await tick();
    return { canvas, context };
}
function draw() {
    call('startStroke', { touches: [{ x: 20, y: 20 }] });
    call('moveStroke', { touches: [{ x: 90, y: 100 }] });
    call('endStroke');
}
beforeEach(() => {
    vi.resetModules(); vi.resetAllMocks(); m.owner = 'tenant'; page = undefined;
    m.contract.mockReturnValue({ promise: Promise.resolve({ value: { tenant_signature: { account_id: 'tenant', name: '测试承租人' }, current_attempt: null, allowed_actions: [{ action_code: 'SIGN_CONTRACT', allowed: true }] }, etag: '"CONTRACT:c1:1"' }) });
    m.hasAgreement.mockReturnValue(true); m.draftRead.mockReturnValue(null); m.pendingSignature.mockReturnValue(null);
    vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/contract/index', options: { orderId: 'o1' } }, page]);
    vi.stubGlobal('wx', { getWindowInfo: () => ({ pixelRatio: 2 }), navigateBack: vi.fn(), redirectTo: vi.fn(), showModal: vi.fn(), enableAlertBeforeUnload: vi.fn(), disableAlertBeforeUnload: vi.fn() });
});
afterEach(() => { if (page) call('onUnload'); vi.unstubAllGlobals(); });

test.each([null, 'another-account'])('expired or changed account can leave the canvas without retaining previous handwriting: %s', async owner => {
    await mount(); draw(); expect(page!.data['hasInk']).toBe(true);
    m.owner = owner; call('back'); call('back');
    expect(page!.data).toMatchObject({ ready: false, name: '', hasInk: false });
    expect(wx.showModal).not.toHaveBeenCalled(); expect(wx.navigateBack).toHaveBeenCalledTimes(1);
    expect(m.submit).not.toHaveBeenCalled(); expect(m.contract).toHaveBeenCalledTimes(1);
});

test('401 during a fresh contract read still leaves a usable return action', async () => {
    await mount();
    m.contract.mockImplementationOnce(() => { m.owner = null; return { promise: Promise.reject(new Error('登录已失效')) }; });
    await call('load'); expect(page!.data).toMatchObject({ ready: false, busy: false, name: '', errorText: expect.stringContaining('登录') });
    call('back'); expect(wx.navigateBack).toHaveBeenCalledTimes(1); expect(m.submit).not.toHaveBeenCalled();
});

test.each(['onHide', 'onUnload'])('a %s canvas cannot navigate even when its account expires', async lifecycle => {
    await mount(); call(lifecycle); m.owner = null; call('back'); call('returnContract');
    expect(wx.navigateBack).not.toHaveBeenCalled(); expect(wx.redirectTo).not.toHaveBeenCalled(); expect(m.submit).not.toHaveBeenCalled();
});

test('leaving unsaved handwriting still requires the current user to discard it', async () => {
    await mount(); draw(); call('back'); expect(wx.navigateBack).not.toHaveBeenCalled();
    expect(page!.data['leaveDialog']).toBe(true);
    call('continueSigning'); expect(page!.data).toMatchObject({ leaveDialog: false, hasInk: true }); expect(wx.navigateBack).not.toHaveBeenCalled();
    call('back'); call('discardAndLeave'); expect(page!.data).toMatchObject({ leaveDialog: false, hasInk: false });
    expect(wx.navigateBack).toHaveBeenCalledTimes(1); expect(m.submit).not.toHaveBeenCalled();
});

test('a late discard confirmation cannot navigate after the signature page is hidden', async () => {
    await mount(); draw(); call('back');
    call('onHide'); call('discardAndLeave');
    expect(wx.navigateBack).not.toHaveBeenCalled();
});
test('the leave overlay hides the existing canvas without clearing either stored stroke', async () => {
    const markup = readFileSync('miniprogram/pages/contract-sign/index.wxml', 'utf8');
    const canvasTag = markup.match(/<canvas\b[^>]*\bid="signature-canvas"[^>]*\/>/)?.[0];
    expect(canvasTag).toContain('hidden="{{leaveDialog}}"'); expect(canvasTag).not.toMatch(/wx:(if|elif)/);
    const { canvas, context } = await mount(); draw(); draw();
    const clears = context.clearRect.mock.calls.length, dimensions = [canvas.width, canvas.height];
    call('back'); expect(page!.data).toMatchObject({ leaveDialog: true, ready: true, hasInk: true });
    call('continueSigning'); expect(page!.data).toMatchObject({ leaveDialog: false, ready: true, hasInk: true });
    expect(context.clearRect).toHaveBeenCalledTimes(clears); expect([canvas.width, canvas.height]).toEqual(dimensions);
    call('undo'); expect(page!.data['hasInk']).toBe(true); call('undo'); expect(page!.data['hasInk']).toBe(false);
    expect(m.submit).not.toHaveBeenCalled(); expect(wx.navigateBack).not.toHaveBeenCalled();
});
test('a stale discard after account change clears private ink without navigating or submitting', async () => {
    await mount(); draw(); call('back'); m.owner = 'other'; call('discardAndLeave');
    expect(page!.data).toMatchObject({ leaveDialog: false, hasInk: false, ready: false });
    expect(wx.navigateBack).not.toHaveBeenCalled(); expect(m.submit).not.toHaveBeenCalled();
});
test('discard is unavailable without an open dialog and while saving', async () => {
    await mount(); draw(); call('discardAndLeave'); expect(page!.data['hasInk']).toBe(true);
    call('back'); page!.data['busy'] = true; call('discardAndLeave'); call('continueSigning');
    expect(page!.data).toMatchObject({ leaveDialog: true, hasInk: true }); expect(wx.navigateBack).not.toHaveBeenCalled();
});
