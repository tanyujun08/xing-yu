import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { partitionWithdrawalRecords, useWithdrawalReferencePreview, type WithdrawalDisplayRecord } from '../miniprogram/shared/presentation/withdrawal-layout';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
vi.mock('../miniprogram/shared/api/mock-api', () => { throw new Error('Withdrawal must not import the retired Mock API'); });
vi.mock('../miniprogram/shared/fixture/index', () => { throw new Error('Withdrawal must not initialize rental fixtures'); });

const record = (id: string, state: string, createdText: string): WithdrawalDisplayRecord => ({ id, state, createdText, amountText: '¥100', stateText: state, stateTone: state, accountLabel: '微信账户' });

interface WithdrawalPageProbe {
  data: { referencePreview: boolean; view: string; availableFen: number | null; availableText: string; processingFen: number | null; amount: string; amountFocused: boolean; amountDisabled: boolean; submitDisabled: boolean; walletReady: boolean; errorText: string; submissionKey: string; currentWithdrawal: WithdrawalDisplayRecord | null; historyWithdrawals: WithdrawalDisplayRecord[]; withdrawals: WithdrawalDisplayRecord[] };
  setData(patch: Record<string, unknown>): void;
  onLoad(options: Record<string, string>): void;
  loadWallet(): void;
  input(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  amountFocus(): void;
  amountBlur(): void;
  fillAll(): void;
  openRecords(): void;
  submit(): Promise<void>;
  withdrawalAction(event: WechatMiniprogram.TouchEvent): void;
  showBalanceHelp(): Promise<void>;
  contactSupport(): void;
  goBack(): void;
  onUnload(): void;
}

async function captureWithdrawal(stage: string, platform: string) {
  vi.resetModules();
  let definition: unknown;
  const effects = {
    getStorageSync: vi.fn(), setStorageSync: vi.fn(), request: vi.fn(), uploadFile: vi.fn(), requestPayment: vi.fn(), chooseMedia: vi.fn(),
    showToast: vi.fn(), showModal: vi.fn(async () => ({ confirm: true, cancel: false })),
    navigateTo: vi.fn((options: { complete?: (result: { errMsg: string }) => void }) => options.complete?.({ errMsg: 'navigateTo:ok' })),
    navigateBack: vi.fn((options: { complete?: (result: { errMsg: string }) => void }) => options.complete?.({ errMsg: 'navigateBack:ok' })),
  };
  vi.stubGlobal('wx', { ...effects, getAccountInfoSync: () => ({ miniProgram: { envVersion: stage } }), getDeviceInfo: () => ({ platform }) });
  vi.stubGlobal('Page', (options: unknown) => { definition = options; });
  await import('../miniprogram/pages/withdrawal/index');
  const page = definition as WithdrawalPageProbe;
  page.setData = patch => { Object.assign(page.data, patch); };
  return { page, effects };
}

describe('withdrawal reference layout', () => {
  test('persistent visual preview is isolated to development tools and blocks commands', () => {
    expect(useWithdrawalReferencePreview('develop', 'devtools')).toBe(true);
    for (const stage of ['trial', 'release']) expect(useWithdrawalReferencePreview(stage, 'devtools')).toBe(false);
    for (const platform of ['ios', 'android']) expect(useWithdrawalReferencePreview('develop', platform)).toBe(false);
    const source = readFileSync('miniprogram/pages/withdrawal/index.ts', 'utf8');
    expect(source).toMatch(/loadWallet\(\) \{\s*if \(referencePreviewEnabled\(\)\)/);
    expect(source).toMatch(/submit\(\) \{\s*if \(this.data.referencePreview \|\| referencePreviewEnabled\(\)\)/);
    expect(source).toMatch(/withdrawalAction\([^]*?\) \{\s*if \(this.data.referencePreview \|\| referencePreviewEnabled\(\)\)/);
  });
  test('development preview keeps editable input and empty records without financial facts or commands', async () => {
    const { page, effects } = await captureWithdrawal('develop', 'devtools');
    page.onLoad({ view: 'apply' });
    page.loadWallet();
    expect(page.data).toMatchObject({ referencePreview: true, view: 'apply', availableFen: null, availableText: '—', processingFen: null, walletReady: false, amountDisabled: false, submitDisabled: true, currentWithdrawal: null, historyWithdrawals: [], withdrawals: [], submissionKey: '' });
    page.input({ detail: { value: '1.25' } } as WechatMiniprogram.CustomEvent<{ value: string }>);
    page.amountFocus();
    expect(page.data).toMatchObject({ amount: '1.25', amountFocused: true, submitDisabled: true });
    page.amountBlur();
    page.fillAll();
    expect(page.data).toMatchObject({ amount: '1.25', amountFocused: false });
    await page.submit();
    page.withdrawalAction({ currentTarget: { dataset: { id: 'prior-id', state: 'failed' } } } as unknown as WechatMiniprogram.TouchEvent);
    expect(effects.showToast.mock.calls.every(([options]) => options.title === '仅供视觉预览，不执行提现' && options.icon === 'none')).toBe(true);
    expect(effects.showToast).toHaveBeenCalledTimes(2);
    page.openRecords();
    expect(page.data).toMatchObject({ view: 'records', currentWithdrawal: null, withdrawals: [] });
    for (const effect of [effects.getStorageSync, effects.setStorageSync, effects.request, effects.uploadFile, effects.requestPayment, effects.chooseMedia]) expect(effect).not.toHaveBeenCalled();
  });
  test('unknown balances close submission before intent while amount validation and informational navigation remain', async () => {
    const { page, effects } = await captureWithdrawal('release', 'ios');
    page.loadWallet();
    expect(page.data).toMatchObject({ referencePreview: false, availableFen: null, availableText: '—', walletReady: false, amountDisabled: true, currentWithdrawal: null, withdrawals: [] });
    await page.submit();
    expect(page.data.errorText).toBe('可提现余额暂不可用，请稍后再试。');
    expect(page.data.errorText).not.toContain('不足');
    page.withdrawalAction({ currentTarget: { dataset: { id: 'prior-id', state: 'unknown' } } } as unknown as WechatMiniprogram.TouchEvent);
    expect(effects.showToast).toHaveBeenCalledWith({ title: '提现查询暂不可用，请稍后再试。', icon: 'none' });

    // Isolated values exercise the existing input rules; they are never loaded as a balance.
    page.setData({ walletReady: true, availableFen: 99 });
    await page.submit();
    expect(page.data.errorText).toBe('可提现余额不足1元，暂不能提交。');
    page.setData({ availableFen: 200, amountDisabled: false });
    for (const value of ['', 'text', '-1', '0.5', '3']) {
      page.input({ detail: { value } } as WechatMiniprogram.CustomEvent<{ value: string }>);
      expect(page.data.submitDisabled).toBe(true);
      await page.submit();
      expect(page.data.errorText).toContain('不低于1元且不超过');
    }
    page.input({ detail: { value: '1.25' } } as WechatMiniprogram.CustomEvent<{ value: string }>);
    expect(page.data.submitDisabled).toBe(false);
    await page.submit();
    expect(page.data.errorText).toBe('提现服务暂不可用，请稍后再试。');
    page.setData({ availableFen: 125 });
    page.fillAll();
    expect(page.data.amount).toBe('1.25');
    page.setData({ availableFen: 100 });
    page.fillAll();
    expect(page.data.amount).toBe('1');
    expect(page.data.submissionKey).toBe('');
    expect(page.data.currentWithdrawal).toBeNull();
    expect(effects.showToast.mock.calls.every(([options]) => options.icon !== 'success')).toBe(true);
    for (const effect of [effects.getStorageSync, effects.setStorageSync, effects.request, effects.uploadFile, effects.requestPayment, effects.chooseMedia]) expect(effect).not.toHaveBeenCalled();

    await Promise.all([page.showBalanceHelp(), page.showBalanceHelp()]);
    expect(effects.showModal).toHaveBeenCalledOnce();
    page.contactSupport();
    expect(effects.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/chat/index?mode=support' }));
    page.goBack();
    expect(effects.navigateBack).toHaveBeenCalledOnce();
    page.onUnload();
  });
  test('selects newest pending record without losing or mutating other records', () => {
    const rows = [record('old', 'processing', '2026-08-01'), record('done', 'completed', '2026-09-06'), record('current', 'unknown', '2026-09-04'), record('failed', 'failed', '2026-09-02')];
    const snapshot = structuredClone(rows);
    const result = partitionWithdrawalRecords(rows);
    expect(result.currentWithdrawal?.id).toBe('current');
    expect(result.currentWithdrawal?.state).toBe('unknown');
    expect(result.currentWithdrawal?.progressTimeText).toBe('09-04');
    expect(result.historyWithdrawals.map((item) => item.id)).toEqual(['done', 'failed', 'old']);
    expect(rows).toEqual(snapshot);
  });
  test('no active card is fabricated for empty or all-terminal records', () => {
    expect(partitionWithdrawalRecords([])).toEqual({ currentWithdrawal: null, historyWithdrawals: [] });
    expect(partitionWithdrawalRecords([record('done', 'completed', '2026-09-06')]).currentWithdrawal).toBeNull();
  });
  test('semantic cards and flat sections remain distinct, with safe actions preserved', () => {
    const view = readFileSync('miniprogram/pages/withdrawal/index.wxml', 'utf8');
    expect(view).toContain('class="balance-block withdrawal-summary xy-card"');
    expect(view).toContain('class="account-section xy-card {{accountJoined ? \'account-section--joined\' : \'\'}}"');
    expect(view).toContain('class="withdrawal-record--current xy-card"');
    expect(view).toContain('class="withdrawal-explanation"');
    expect(view).toContain('class="history-section"');
    expect(view).not.toContain('更换账户');
    expect(view).not.toContain('银行卡信息异常');
    expect(view).toContain('bindtap="withdrawalAction"');
    expect(view).toContain('disabled="{{submitting || submitDisabled}}"');
    const css = readFileSync('miniprogram/pages/withdrawal/index.wxss', 'utf8');
    expect(css).toContain('.history-section { margin-top: var(--xy-layout-section-gap); }');
    expect(css).toContain('.explanation-list, .history-list { margin-top: var(--xy-layout-title-content-gap); }');
    expect(css).toMatch(/\.explanation-row \{[^}]*padding: var\(--xy-space-3\) 0;/);
    expect(css).not.toContain('.explanation-row:first-child');
    expect(css).toMatch(/\.explanation-list[^}]*background: var\(--xy-color-surface\);/);
    expect(css).toMatch(/\.history-list \{[^}]*background: var\(--xy-color-surface\);/);
  });
  test('uses supplied illustration geometry instead of an account-icon placeholder', () => {
    const svg = readFileSync('static-assets/assets/illustrations/withdrawal-balance.svg', 'utf8');
    expect(svg).toContain('viewBox="0 0 180 128"');
    expect(svg).toContain('id="walletFrontWait"');
    expect(svg).toContain('cx="128" cy="83" r="23"');
    expect(svg).toContain('d="M128 70V85"');
  });
  test('uses the supplied available illustration above the withdrawal threshold', () => {
    const view = readFileSync('miniprogram/pages/withdrawal/index.wxml', 'utf8');
    expect(view).toContain('src="{{availableFen >= 100 ? availableHeroArt : heroArt}}"');
    const svg = readFileSync('static-assets/assets/illustrations/withdrawal-available.svg', 'utf8');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 180 128"');
    expect(svg).toContain('id="coinSuccess"');
    expect(svg).toContain('d="M118 83L125 90L138 76"');
    expect(svg).toContain('flood-opacity="0.24"');
  });
  test('keeps icon geometry and contextual recovery actions aligned with the reference', () => {
    const css = readFileSync('miniprogram/pages/withdrawal/index.wxss', 'utf8');
    const view = readFileSync('miniprogram/pages/withdrawal/index.wxml', 'utf8');
    const tokens = readFileSync('miniprogram/app.wxss', 'utf8');
    expect(tokens).toContain('--xy-size-icon-entry-block: 40px');
    expect(css).toMatch(/\.explanation-row \{[^}]*align-items: center;[^}]*gap: var\(--xy-space-3\);/);
    expect(css).toMatch(/\.history-line \{[^}]*align-items: center;/);
    expect(css).toContain('.balance-block.xy-card, .withdrawal-record--current.xy-card { padding: var(--xy-inset-card); border-radius: var(--xy-radius-emphasis); background: var(--xy-color-surface); }');
    expect(css).not.toContain('linear-gradient(');
    expect(view).toContain('wx:if="{{currentWithdrawal.state === \'unknown\'}}" class="record-footer"');
    expect(view).toMatch(/class="failure-notice">\s*<text class="failure-copy">[^]*?<\/text>\s*<\/view>/);
    expect(css).toMatch(/\.history-copy \{[^}]*margin-top: 0;/);
    expect(css).toMatch(/\.failure-notice \{[^}]*margin-top: var\(--xy-space-1\)[^}]*padding: 0;/);
    expect(css).toContain('.history-row:first-child { padding-top: var(--xy-space-3); }');
    expect(css).toContain('.record-head .record-amount { min-width: 0; margin-top: 0; }');
  });
  test('refinement separates hierarchy without repeated alerts or new business controls', () => {
    const view = readFileSync('miniprogram/pages/withdrawal/index.wxml', 'utf8');
    const css = readFileSync('miniprogram/pages/withdrawal/index.wxss', 'utf8');
    expect(view).not.toContain('class="processing-notice"');
    expect(view).not.toContain('class="account-detail"');
    expect(view).not.toContain('currentWithdrawal.progressTimeText');
    expect(view).toContain('申请时间 {{currentWithdrawal.createdText}}');
    expect(view).toContain('layout="primary-emphasis"');
    expect(view).toContain('wx:elif="{{referencePreview || availableFen >= 100}}"');
    expect(view).toContain('placeholder="0.00"');
    expect(view).toContain('class="field-guidance">最低 ¥1</text>');
    expect(css).toMatch(/\.amount-field \{[^}]*min-height: var\(--xy-control-height\);[^}]*margin-top: var\(--xy-space-3\);[^}]*border-radius: var\(--xy-radius-md\)/);
    expect(css).toMatch(/\.withdrawal-explanation \{[^}]*padding: 0; background: var\(--xy-color-page\)/);
    expect(css).toMatch(/\.info-icon-frame \{[^}]*height: var\(--xy-size-icon-nav\)/);
    expect(css).toMatch(/\.account-section\.xy-card\.account-section--joined \{[^}]*border-top: var\(--xy-divider-hairline\) solid/);
    expect(css).toContain('font-variant-numeric: tabular-nums');
    expect(css).toMatch(/\.progress-dot \{[^}]*width: var\(--xy-size-icon-base\);/);
    expect(css).not.toContain('.progress-step.is-current .progress-dot');
    const failureRule = css.match(/\.failure-notice \{([^}]+)\}/)?.[1];
    expect(failureRule).not.toContain('background');
    const footer = readFileSync('miniprogram/components/bottom-actions/index.wxss', 'utf8');
    expect(footer).toContain('.bottom-actions--primary-emphasis .bottom-actions__button:last-child { flex: 3; }');
    expect(footer).not.toContain('.bottom-actions--primary-emphasis .xy-action-hit.is-disabled .xy-action-primary');
    expect(readFileSync('miniprogram/shared/design/components.wxss', 'utf8')).toContain('linear-gradient(var(--xy-member-color-button-overlay), var(--xy-member-color-button-overlay)), var(--xy-color-action-primary');
    expect(readFileSync('miniprogram/app.wxss', 'utf8')).toContain('--xy-member-color-surface-overlay: rgba(255, 255, 255, .7);');
    expect(footer).toContain('border: 0; background: transparent;');
    expect(view).toContain('<page-shell surface="surface">');
    expect(readFileSync('miniprogram/components/bottom-actions/index.ts', 'utf8')).toContain("layout: { type: String, value: 'equal' }");
  });
  test('high fidelity keeps structure while sharing the processing status and money baseline', () => {
    const view = readFileSync('miniprogram/pages/withdrawal/index.wxml', 'utf8');
    const css = readFileSync('miniprogram/pages/withdrawal/index.wxss', 'utf8');
    expect(view.match(/<fund-status /g)).toHaveLength(2);
    expect(view).toContain('state="processing" label="提现处理中"');
    expect(view).toContain('state="{{currentWithdrawal.state}}" label="{{currentWithdrawal.stateText}}"');
    expect(view).not.toContain('class="record-status"');
    expect(view).toContain('class="explanation-row-label"');
    expect(view).toContain('class="info-icon"');
    expect(css).toMatch(/\.summary-amount, \.record-amount \{ display: flex; align-items: baseline;/);
    expect(css).toContain('.account-section.xy-card { padding: var(--xy-inset-card);');
    const status = readFileSync('miniprogram/components/fund-status/index.wxss', 'utf8');
    expect(status).toContain('min-height: var(--xy-size-icon-nav, 24px)');
    expect(status).toContain('font-weight: var(--xy-text-weight-medium, 500)');
    expect(readFileSync('miniprogram/components/fund-status/index.ts', 'utf8')).not.toMatch(/mockApi|wx\.|triggerEvent/);
  });
  test('typography has deliberate primary, body and metadata roles without competing carriers', () => {
    const css = readFileSync('miniprogram/pages/withdrawal/index.wxss', 'utf8');
    const status = readFileSync('miniprogram/components/fund-status/index.wxss', 'utf8');
    expect(css).toMatch(/\.summary-amount, \.record-amount \{[^}]*font-weight: var\(--xy-text-weight-semibold\)/);
    expect(css).not.toContain('var(--xy-text-weight-bold)');
    expect(css).toMatch(/\.history-line \.record-state-text \{[^}]*font-size: var\(--xy-text-body-size\); font-weight: var\(--xy-text-weight-medium\)/);
    expect(css).toMatch(/\.record-meta \{[^}]*font-size: var\(--xy-text-caption-size\)/);
    expect(status).not.toContain('background:');
    expect(css).toContain('.history-copy { min-width: 0;');
    expect(css).toMatch(/\.processing-line \{[^}]*display: flex;[^}]*align-items: center;/);
  });
  test('refined grouping does not distribute one funds object across unrelated axes', () => {
    const css = readFileSync('miniprogram/pages/withdrawal/index.wxss', 'utf8');
    const rule = (selector: string) => css.slice(css.indexOf(`${selector} {`)).split('}')[0];
    expect(rule('.record-head')).toContain('flex-direction: column');
    expect(rule('.record-head')).toContain('align-items: flex-start');
    expect(rule('.processing-summary')).toContain('margin-top: var(--xy-space-3)');
    expect(rule('.explanation-row-title')).toContain('font-weight: var(--xy-text-weight-medium)');
    expect(rule('.explanation-row-detail')).toContain('font-weight: var(--xy-text-weight-regular)');
    expect(rule('.history-amount')).toContain('line-height: var(--xy-text-section-title-line-height)');
    expect(rule('.withdrawal-hero-art')).not.toContain('opacity');
    const view = readFileSync('miniprogram/pages/withdrawal/index.wxml', 'utf8');
    expect(view).not.toContain('class="record-estimate"');
    expect(view).toMatch(/class="record-head">[^]*?class="record-amount[^]*?class="record-aside"[^]*?class="record-details"[^]*?class="record-account"[^]*?class="record-meta"/);
    expect(view).toContain('class="progress-estimate"');
    expect(rule('.history-amount')).not.toContain('position: absolute');
    expect(rule('.history-line')).toContain('fit-content(40%)');
    expect(rule('.info-icon-frame')).toContain('width: var(--xy-size-icon-nav)');
    expect(view).not.toContain('class="history-end"');
  });
  test('withdrawal restores the native shell footer and safe area without a content variant', () => {
    const css = readFileSync('miniprogram/components/page-shell/index.wxss', 'utf8');
    const view = readFileSync('miniprogram/components/page-shell/index.wxml', 'utf8');
    const ts = readFileSync('miniprogram/components/page-shell/index.ts', 'utf8');
    expect(ts).not.toContain('footerPlacement');
    expect(view).not.toContain('content-footer');
    expect(css).toContain('.page-shell__main { min-height: 0; flex: 1 0 auto; }');
    expect(css).toContain('padding-bottom: env(safe-area-inset-bottom)');
    expect(css).toContain('.page-shell__footer { position: sticky;');
  });
  test('balance help is a labelled touch target with a guarded informational action', () => {
    const view = readFileSync('miniprogram/pages/withdrawal/index.wxml', 'utf8');
    const css = readFileSync('miniprogram/pages/withdrawal/index.wxss', 'utf8');
    const source = readFileSync('miniprogram/pages/withdrawal/index.ts', 'utf8');
    expect(view).toContain('bindtap="showBalanceHelp" aria-label="查看可提现余额说明"');
    expect(css).toMatch(/\.summary-help-button \{[^}]*min-width: var\(--xy-size-touch-min\); min-height: var\(--xy-size-touch-min\)/);
    const handler = source.slice(source.indexOf('  showBalanceHelp()'), source.indexOf('  contactSupport()'));
    expect(handler).toContain("scope.singleFlight('withdrawal:balance-help'");
    expect(handler).toContain('if (scope.disposed) return;');
    expect(handler).toContain('wx.showModal');
    expect(handler).not.toMatch(/mockApi\.|navigateTo|setStorage/);
  });
  test('status symbols and circles share SVG geometry, not font baselines', () => {
    const view = readFileSync('miniprogram/pages/withdrawal/index.wxml', 'utf8');
    expect(view).not.toMatch(/[✓×◷]/);
    expect(view).not.toContain('>?</text>');
    expect(view).toContain('<image class="history-status"');
    expect(view).toContain('src="{{stepIcons.completed}}"');
    for (const name of ['completed', 'failed', 'pending']) {
      const svg = readFileSync(`static-assets/assets/figma-icons/withdrawal-status-${name}.svg`, 'utf8');
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('stroke-width="1.8"');
      expect(svg).not.toContain('<text');
    }
    const css = readFileSync('miniprogram/pages/withdrawal/index.wxss', 'utf8');
    expect(css).toContain('.history-line .record-state-text');
    expect(css).toContain('line-height: var(--xy-text-body-line-height)');
    expect(css).toContain('line-height: var(--xy-text-body-small-line-height)');
    expect(css).toContain('.history-copy .record-meta { margin-top: var(--xy-space-1);');
  });
});
