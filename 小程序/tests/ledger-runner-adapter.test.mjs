import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';
import { expect, test, vi } from 'vitest';
import {
  buildWechatIdeInvocation, LOGIN_SELECTORS, WechatIdeController, WechatIdeToolError,
  LOGIN_COMPONENT_READER, LEDGER_COMPONENT_READER, validateLoginSnapshot, validateLedgerSnapshot,
} from '../.wechat-test/runner/wechatide-controller.mjs';
import { executeStep, waitForStepCondition } from '../.wechat-test/runner/run-readonly-test.mjs';

const options = {
  commandPath: 'C:/tools/wechatide.cmd',
  windowsCommandPath: 'C:/Windows/System32/cmd.exe',
  projectPath: 'C:/project',
  clientName: 'Codex',
  // These are host-only adapter response fixtures. No DevTools, shell, runtime evidence or login.
  mcpToken: 'synthetic-adapter-test-token',
};
function invocation(tool, args) { return buildWechatIdeInvocation({ ...options, tool, args, platform: 'win32' }); }
function rect(left = 32, top = 500, width = 44, height = 44) {
  return { left, top, right: left + width, bottom: top + height, width, height, dataset: {}, disabled: false,
    'font-size': '16px', 'text-overflow': 'clip', 'white-space': 'normal' };
}
function loginSnapshot(checked = false) {
  const nodes = Object.fromEntries(Object.values(LOGIN_SELECTORS).map(selector => [selector, rect()]));
  nodes['.login-overlay'] = rect(0, 0, 390, 844);
  nodes[LOGIN_SELECTORS.root] = rect(0, 379, 390, 465);
  nodes[LOGIN_SELECTORS.agreement] = { ...rect(32, 702, 326, 44), ariaChecked: String(checked) };
  nodes['.agree-box'] = rect(67, 715, 18, 18);
  nodes[LOGIN_SELECTORS.wechat] = rect(32, 537, 326, 48);
  return { ok: true, route: 'pages/login/index', samePage: true, sampledAt: Date.now(),
    errorText: '', agreed: checked, visible: true, submitting: false, showConsentModal: false, nodes,
    legalLinks: [{ ...rect(160, 702), dataset: { legal: 'user-agreement' } },
      { ...rect(270, 702), dataset: { legal: 'privacy-policy' } }],
    checkedMarkers: checked ? [rect(67, 715, 18, 18)] : [] };
}
function ledgerSnapshot(selected = 'all') {
  return { ok: true, route: 'pages/powder-ledger/index', samePage: true, sampledAt: Date.now(), value: selected,
    tabs: ['all', 'income', 'expense'].map((id, index) => ({
      ...rect(32 + index * 100, 100), dataset: { value: id }, ariaSelected: String(id === selected),
    })) };
}
class ProbeController extends WechatIdeController {
  constructor() {
    super(options);
    this.calls = [];
    this.pagePath = 'pages/powder-ledger/index';
    this.selected = 'all';
    this.checked = false;
    this.loggedIn = true;
    this.snapshotFilter = 'expense';
    this.rewriteSnapshot = snapshot => snapshot;
    this.viewport = { windowWidth: 390, windowHeight: 844 };
  }
  async runTool(tool, args) {
    invocation(tool, args);
    this.calls.push({ tool, args });
    const get = flag => args[args.indexOf(flag) + 1];
    if (tool === 'automation_runtime_info') return { currentPage: { path: this.pagePath } };
    if (tool === 'automation_page_action') return { data: { ledgerFilter: this.snapshotFilter, loggedIn: this.loggedIn } };
    if (tool === 'automation_navigate') {
      this.pagePath = get('--url').replace(/^\//u, '');
      this.checked = false;
      return { success: true };
    }
    if (tool === 'automation_evaluate') {
      const source = get('--fn-source');
      const snapshot = source === LOGIN_COMPONENT_READER ? loginSnapshot(this.checked) : ledgerSnapshot(this.selected);
      snapshot.route = this.pagePath;
      return { success: true, result: { result: this.rewriteSnapshot(snapshot) } };
    }
    if (tool === 'automation_element_action' && get('--action') === 'tap') {
      expect(args).not.toContain('--selector');
      expect(args).not.toContain('--wait-for-selector');
      if (this.pagePath === 'pages/login/index') {
        if (Number(get('--y')) > 700) this.checked = !this.checked;
        else this.pagePath = 'pages/home/index';
      }
      return { success: true, mode: 'coordinate', x: Number(get('--x')), y: Number(get('--y')) };
    }
    throw new Error('unexpected official tool in host fixture');
  }
}

test('allows only two complete fixed readonly functions and rejects dynamic evaluate arguments', () => {
  for (const source of [LOGIN_COMPONENT_READER, LEDGER_COMPONENT_READER]) {
    expect(/[\r\n"&|<>^%!]/u.test(source)).toBe(false);
    expect(invocation('automation_evaluate', ['--project', options.projectPath, '--fn-source', source]).args[4]).toContain(source);
    for (const candidate of [source + ' ', 'function(){return true;}', source.replace('selectComponent', 'setData')]) {
      expect(() => invocation('automation_evaluate', ['--project', options.projectPath, '--fn-source', candidate])).toThrow('complete reviewed component reader');
    }
    expect(() => invocation('automation_evaluate', ['--project', options.projectPath, '--fn-source', source, '--args', '[]'])).toThrow('without dynamic arguments');
  }
});

test('rejects the retired deep-selector escape and injected command characters in every argument', () => {
  const unsafe = ['#login-sheet >>> .agreement-row', '.ledger-tabs-control >>> .section-tabs__hit',
    'value&whoami', 'value|whoami', 'value>output', 'value\nwhoami', 'value\rwhoami',
    'value"', '%PATH%', '!PATH!', '^'];
  for (const value of unsafe) {
    for (const flag of ['--selector', '--wait-for-selector', '--project', '--name', '--value']) {
      expect(() => invocation('automation_element_action', [flag, value])).toThrow('prohibited Windows command character');
    }
  }
});

test('reads one real component snapshot for the three ledger hits and exposes actual ARIA without synthetic class', async () => {
  const controller = new ProbeController();
  const page = await controller.currentPage();
  const tabs = await page.$$('.ledger-tab');
  expect(tabs).toHaveLength(3);
  expect(controller.calls.filter(call => call.tool === 'automation_evaluate')).toHaveLength(1);
  expect(controller.calls.some(call => call.tool === 'automation_page_action')).toBe(false);
  expect(await tabs[0].attribute('data-filter')).toBe('all');
  expect(await tabs[0].attribute('aria-selected')).toBe('true');
  expect(await tabs[2].attribute('aria-selected')).toBe('false');
  await expect(tabs[0].attribute('class')).rejects.toThrow('outside the reviewed allowlist');
  expect((await page.data()).ledgerFilter).toBe('expense');
});

test('re-reads observed ledger identity before each official coordinate tap', async () => {
  const controller = new ProbeController();
  const page = await controller.currentPage();
  const tabs = await page.$$('.ledger-tab');
  await tabs[1].tap();
  expect(controller.calls.filter(call => call.tool === 'automation_evaluate')).toHaveLength(2);
  const tap = controller.calls.find(call => call.args.includes('tap'));
  expect(tap.args).toEqual(['--project', options.projectPath, '--action', 'tap', '--x', '154', '--y', '122']);
  controller.rewriteSnapshot = snapshot => { snapshot.tabs[1].dataset.value = 'expense'; return snapshot; };
  await expect(tabs[1].tap()).rejects.toThrow('not uniquely observable');
  expect(controller.calls.filter(call => call.args.includes('tap'))).toHaveLength(1);
});

test('requires exactly three unique declared ledger datasets, visible hits and matching actual selection', () => {
  for (const change of [
    snapshot => { snapshot.tabs.pop(); },
    snapshot => { snapshot.tabs[1].dataset.value = 'all'; },
    snapshot => { snapshot.tabs[1].dataset.value = 'other'; },
    snapshot => { snapshot.tabs[1].width = 0; },
    snapshot => { snapshot.tabs[1].ariaSelected = 'unknown'; },
    snapshot => { snapshot.value = 'expense'; },
    snapshot => { snapshot.samePage = false; },
  ]) {
    const snapshot = ledgerSnapshot(); change(snapshot);
    expect(() => validateLedgerSnapshot(snapshot)).toThrow();
  }
});

test('refuses component readers outside their exact page and unsupported collections', async () => {
  const controller = new ProbeController();
  controller.pagePath = 'pages/orders/index';
  const page = await controller.currentPage();
  await expect(page.$$('.ledger-tab')).rejects.toThrow('requires the powder-ledger page');
  await expect(page.$$('.arbitrary')).rejects.toThrow('outside the reviewed allowlist');
  await expect(page.$(LOGIN_SELECTORS.agreement)).rejects.toThrow('exact declared page');
  expect(controller.calls.some(call => call.tool === 'automation_evaluate')).toBe(false);
});

test('reads all login layout fields from one native snapshot and keeps real dimensions', async () => {
  const controller = new ProbeController(); controller.pagePath = 'pages/login/index';
  const { page } = await controller.readLoginPage();
  for (const selector of Object.values(LOGIN_SELECTORS)) {
    const element = await page.$(selector);
    expect(await element.size()).toMatchObject({ width: expect.any(Number), height: expect.any(Number) });
    if (selector === LOGIN_SELECTORS.root) expect(await element.style('font-size')).toBe('16px');
  }
  expect(controller.calls).toHaveLength(1);
  controller.rewriteSnapshot = snapshot => { snapshot.nodes[LOGIN_SELECTORS.close].width = 20.53125; return snapshot; };
  const { page: narrow } = await controller.readLoginPage();
  expect(await (await narrow.$(LOGIN_SELECTORS.close)).size()).toEqual({ width: 20.53125, height: 44 });
});

test('requires strict actual consent boolean, actual ARIA and rendered marker agreement', () => {
  for (const checked of [false, true]) expect(validateLoginSnapshot(loginSnapshot(checked)).agreed).toBe(checked);
  for (const change of [
    snapshot => { snapshot.agreed = 'false'; },
    snapshot => { delete snapshot.errorText; },
    snapshot => { delete snapshot.nodes[LOGIN_SELECTORS.agreement].ariaChecked; },
    snapshot => { snapshot.nodes[LOGIN_SELECTORS.agreement].ariaChecked = 'true'; },
    snapshot => { snapshot.checkedMarkers = [rect()]; },
    snapshot => { snapshot.visible = false; },
    snapshot => { snapshot.samePage = false; },
    snapshot => { snapshot.nodes['.agree-box'].width = 0; },
  ]) {
    const snapshot = loginSnapshot(); change(snapshot);
    expect(() => validateLoginSnapshot(snapshot)).toThrow();
  }
});

test('matches two native legal dataset identities uniquely without attribute-selector guesses', () => {
  const snapshot = loginSnapshot();
  snapshot.legalLinks.reverse();
  const actual = validateLoginSnapshot(snapshot);
  expect(actual.nodes[LOGIN_SELECTORS.userAgreement]).toBe(snapshot.legalLinks[1]);
  expect(actual.nodes[LOGIN_SELECTORS.privacy]).toBe(snapshot.legalLinks[0]);
  snapshot.legalLinks[0].dataset.legal = 'user-agreement';
  expect(() => validateLoginSnapshot(snapshot)).toThrow('not uniquely observable');
});

test('taps agreement checkbox center rather than row center or nested legal catchtap', async () => {
  const controller = new ProbeController(); controller.pagePath = 'pages/login/index';
  const { page } = await controller.readLoginPage();
  const agreement = await page.$(LOGIN_SELECTORS.agreement);
  expect(await agreement.attribute('aria-checked')).toBe('false');
  await agreement.tap();
  const tap = controller.calls.find(call => call.args.includes('tap'));
  expect(tap.args).toEqual(['--project', options.projectPath, '--action', 'tap', '--x', '76', '--y', '724']);
  expect((await controller.readLoginSnapshot()).agreed).toBe(true);
});

test('refuses overlapping legal hits, offscreen coordinates and stale geometry', async () => {
  const controller = new ProbeController();
  const snapshot = validateLoginSnapshot(loginSnapshot());
  snapshot.legalLinks[0] = { ...snapshot.nodes['.agree-box'], dataset: { legal: 'user-agreement' } };
  await expect(controller.tapComponentNode(snapshot, snapshot.nodes['.agree-box'], true)).rejects.toThrow('overlaps');
  await expect(controller.tapComponentNode(snapshot, rect(400, 100))).rejects.toThrow('outside the observed viewport');
  snapshot.sampledAt = Date.now() - 6000;
  await expect(controller.tapComponentNode(snapshot, rect())).rejects.toThrow('fresh actual snapshot');
  expect(controller.calls).toHaveLength(0);
});

test('checks snapshot freshness again after invocation quota waiting before spawning any official command', async () => {
  class QuotaProbe extends WechatIdeController { async reserveInvocationSlot() {} }
  const controller = new QuotaProbe(options);
  await expect(controller.invoke('automation_element_action', ['--action', 'tap', '--x', '1', '--y', '1'],
    { snapshotSampledAt: Date.now() - 6000 })).rejects.toThrow('fresh actual snapshot after tool quota waiting');
});

test('keeps storage/login injection outside the host method capability', async () => {
  class HostProbe extends WechatIdeController {
    async runTool(tool, args) { expect(tool).toBe('automation_wx_api'); expect(args).not.toContain('--args-file'); return { result: 'observed' }; }
  }
  const controller = new HostProbe(options);
  for (const method of ['getAccountInfoSync', 'startPullDownRefresh']) expect(await controller.callWxMethod(method)).toBe('observed');
  for (const method of ['getStorageSync', 'setStorageSync', 'removeStorageSync', 'login', 'request']) {
    await expect(controller.callWxMethod(method)).rejects.toThrow('outside the reviewed read-only host allowlist');
  }
});
function step(action, expected, target = LOGIN_SELECTORS.agreement) {
  return { id: action + '-' + expected, action, target: { kind: action === 'relaunch' ? 'page' : 'selector', value: target },
    wait: { condition: 'state', expected, timeoutMs: 100 } };
}
function runtimeState() { return { channel: 'wechatide-mcp', observedPages: [], observations: new Map(), interactions: [], businessSessionPresent: null }; }

test('records consent false→true→false only through actual snapshot state and native touch without submitting login', async () => {
  const controller = new ProbeController(); controller.pagePath = 'pages/login/index';
  const state = runtimeState();
  await executeStep(controller, step('relaunch', 'login-agreement-unchecked', 'pages/login/index'), state);
  await executeStep(controller, step('tap', 'login-agreement-checked'), state);
  await executeStep(controller, step('tap', 'login-agreement-unchecked'), state);
  expect([...state.observations]).toEqual([['login:agreement-initial-unchecked', true], ['login:agreement-checked', true], ['login:agreement-restored', true]]);
  expect(state.observedPages).toEqual(['pages/login/index']);
  expect(state.businessSessionPresent).toBeNull();
  expect(controller.calls.filter(call => call.args.includes('tap'))).toHaveLength(2);
});
test('requires actual post-login home route and strict loggedIn true rather than a truthy string', async () => {
  const controller = new ProbeController(); controller.pagePath = 'pages/login/index'; controller.checked = true;
  const state = runtimeState();
  await executeStep(controller, step('tap', 'login-complete', LOGIN_SELECTORS.wechat), state);
  expect(state.observedPages).toEqual(['pages/login/index', 'pages/home/index']);
  expect(state.businessSessionPresent).toBe(true);
  controller.loggedIn = 'true';
  await expect(waitForStepCondition(controller, null, { id: 'strict-login',
    wait: { condition: 'state', expected: 'login-complete', timeoutMs: 5 } })).rejects.toThrow('timed out');
});
test('refuses wrong-page snapshots and unobservable ARIA instead of manufacturing consent evidence', async () => {
  const controller = new ProbeController(); controller.pagePath = 'pages/home/index';
  await expect(waitForStepCondition(controller, null, step('tap', 'login-agreement-checked'))).rejects.toThrow('declared page');
  controller.pagePath = 'pages/login/index';
  controller.rewriteSnapshot = snapshot => { snapshot.nodes[LOGIN_SELECTORS.agreement].ariaChecked = ''; return snapshot; };
  await expect(waitForStepCondition(controller, null, step('tap', 'login-agreement-checked'))).rejects.toThrow('not observable');
});

test('records pre/post burst quota waits before the unchanged settlement deadline and retains two stable reads', async () => {
  const events = []; let filter = 'all'; let readsAfterTap = 0;
  const element = { async attribute(name) { return name === 'aria-selected' ? 'false' : 'income'; },
    async tap() { events.push('native-tap'); filter = 'income'; } };
  const page = { path: 'pages/powder-ledger/index', async $$(selector) { expect(selector).toBe('.ledger-tab'); return [element]; },
    async data() { events.push('native-data'); if (filter === 'income') readsAfterTap += 1;
      return { loggedIn: true, ledgerFilter: filter, items: [{ id: 'row-1' }], listState: { phase: 'ready', incremental: 'idle' } }; } };
  const controller = { async currentPage() { return page; }, async waitForFreshRateWindow() { events.push('quota-wait'); } };
  const state = runtimeState();
  await executeStep(controller, { id: 'burst', action: 'tap-burst-10', target: { kind: 'selector', value: '.ledger-tab' },
    wait: { condition: 'state', expected: 'list-settled', timeoutMs: 100 } }, state);
  expect(events.filter(event => event === 'native-tap')).toHaveLength(10);
  const firstWait = events.indexOf('quota-wait'); const secondWait = events.lastIndexOf('quota-wait');
  expect(events.slice(firstWait + 1, secondWait)).toEqual(Array(10).fill('native-tap'));
  expect(readsAfterTap).toBe(2);
  expect(state.interactions.filter(item => item.action === 'rate-limit-wait')).toHaveLength(2);
  expect(state.observations.get('powder-ledger:burst-selected-noncurrent-filter')).toBe(true);
  expect(state.observations.get('powder-ledger:burst-list-settled')).toBe(true);
});

test('keeps zero-size legacy native hosts invisible', async () => {
  class ZeroProbe extends WechatIdeController {
    async runTool(tool) { return tool === 'automation_runtime_info' ? { currentPage: { path: 'pages/home/index' } } : { width: 0, height: 0 }; }
  }
  const page = await new ZeroProbe(options).currentPage();
  expect(await page.$('.home-page')).toBeNull();
});

const tlsFailure = tool => ({ ok: false, errorType: 'MCP_TOOL_ERROR', source: 'mcp_business',
  reason: 'APPID_ERROR', code: 'APPID_ERROR', tool,
  message: 'Client network socket disconnected before secure TLS connection was established',
  detail: { rawResult: { privateFixtureValue: 'must-not-be-logged' } } });

async function removeOwnedRateDirectory(directory) {
  const physical = await realpath(directory);
  const directoryStat = await lstat(directory);
  if (path.dirname(physical).toLowerCase() !== (await realpath(tmpdir())).toLowerCase() ||
      !path.basename(physical).startsWith('xingyu-adapter-rate-') || directoryStat.isSymbolicLink()) {
    throw new Error('test cleanup target escaped its owned temporary directory');
  }
  await rm(physical, { recursive: true });
}

async function withRateFixture(check) {
  const directory = await mkdtemp(path.join(tmpdir(), 'xingyu-adapter-rate-'));
  const appid = `wx${randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const first = path.join(directory, 'first');
  const second = path.join(directory, 'second');
  await Promise.all([mkdir(first), mkdir(second)]);
  await Promise.all([first, second].map(project => writeFile(path.join(project, 'project.config.json'), JSON.stringify({ appid }))));
  const controller = new WechatIdeController({ ...options, projectPath: first });
  const files = await controller.sharedRateFiles();
  try {
    await check({ controller, files, first, second });
  } finally {
    vi.restoreAllMocks();
    // Only this test's random AppID state and the verified mkdtemp directory are owned here.
    await rm(files.state, { force: true });
    await rm(files.lock, { force: true });
    await removeOwnedRateDirectory(directory);
  }
}

class RetryProbe extends WechatIdeController {
  constructor(projectPath, envelopes) { super({ ...options, projectPath }); this.envelopes = envelopes; this.calls = []; }
  async invoke(tool, args, context) {
    this.calls.push({ tool, args, context });
    await this.reserveInvocationSlot(context.commandDeadlineAt);
    context.commandDeadlineAt ??= Date.now() + this.commandTimeoutMs;
    return this.envelopes.shift();
  }
}

test('retries the exact AppID TLS failure once only for declared reads with the same args and deadline', async () => {
  await withRateFixture(async ({ first, files }) => {
    const diagnostic = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const reads = [
      ['automation_runtime_info', ['--project', first, '--action', 'currentPage']],
      ['automation_page_action', ['--project', first, '--action', 'getData']],
      ['automation_element_action', ['--project', first, '--action', 'attribute', '--selector', '.filter-chip', '--wait-for-selector', '.filter-chip', '--name', 'class']],
      ['automation_evaluate', ['--project', first, '--fn-source', LOGIN_COMPONENT_READER]],
      ['automation_evaluate', ['--project', first, '--fn-source', LEDGER_COMPONENT_READER]],
      ['automation_wx_api', ['--project', first, '--action', 'call', '--method', 'getAccountInfoSync']],
    ];
    for (const [tool, args] of reads) {
      const controller = new RetryProbe(first, [tlsFailure(tool), { ok: true, result: { observed: true } }]);
      expect(await controller.runTool(tool, args)).toEqual({ observed: true });
      expect(controller.calls).toHaveLength(2);
      expect(controller.calls[0].args).toBe(args);
      expect(controller.calls[1].args).toBe(args);
      expect(controller.calls[0].context).toBe(controller.calls[1].context);
      expect(controller.calls[1].context.commandDeadlineAt).toBeLessThanOrEqual(Date.now() + controller.commandTimeoutMs);
    }
    expect(JSON.parse(await readFile(files.state, 'utf8'))).toHaveLength(12);
    const diagnostics = diagnostic.mock.calls.map(([text]) => JSON.parse(text));
    expect(diagnostics).toHaveLength(6);
    for (const value of diagnostics) expect(Object.keys(value).sort()).toEqual(['classification', 'code', 'errorType', 'event', 'tool']);
    expect(JSON.stringify(diagnostics)).not.toContain('must-not-be-logged');
  });
});

test('never retries navigation, touch, lifecycle, refresh, scroll or dynamic evaluate mutations', async () => {
  await withRateFixture(async ({ first, files }) => {
    const diagnostic = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const mutations = [
      ['automation_navigate', ['--project', first, '--action', 'reLaunch', '--url', '/pages/login/index']],
      ['automation_element_action', ['--project', first, '--action', 'tap', '--x', '1', '--y', '1']],
      ['open_project_window', ['--project', first, '--window-mode', 'liteMode']],
      ['close_project_window', ['--project', first]],
      ['automation_wx_api', ['--project', first, '--action', 'call', '--method', 'startPullDownRefresh']],
      ['automation_viewport_action', ['--project', first, '--action', 'pageScrollTo', '--scroll-top', '0']],
      ['automation_evaluate', ['--project', first, '--fn-source', `${LOGIN_COMPONENT_READER} `]],
      ['automation_page_action', ['--project', first, '--action', 'getData', '--mutation', 'unexpected']],
    ];
    for (const [tool, args] of mutations) {
      const controller = new RetryProbe(first, [tlsFailure(tool), { ok: true, result: {} }]);
      await expect(controller.runTool(tool, args)).rejects.toThrow('Client network socket disconnected');
      expect(controller.calls).toHaveLength(1);
    }
    expect(JSON.parse(await readFile(files.state, 'utf8'))).toHaveLength(mutations.length);
    expect(diagnostic).not.toHaveBeenCalled();
  });
});

test('keeps nonexact errors terminal and makes at most one read retry including closed-project probes', async () => {
  await withRateFixture(async ({ first }) => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const tool = 'automation_runtime_info';
    const args = ['--project', first, '--action', 'currentPage'];
    for (const change of [
      { code: 'OTHER' }, { reason: 'OTHER' }, { source: 'cli' }, { errorType: 'CLI_ERROR' },
      { tool: 'automation_navigate' }, { message: `${tlsFailure(tool).message} ` },
    ]) {
      const controller = new RetryProbe(first, [{ ...tlsFailure(tool), ...change }]);
      await expect(controller.runTool(tool, args)).rejects.toThrow();
      expect(controller.calls).toHaveLength(1);
    }
    const failing = new RetryProbe(first, [tlsFailure(tool), tlsFailure(tool), { ok: true, result: {} }]);
    await expect(failing.runTool(tool, args)).rejects.toThrow('Client network socket disconnected');
    expect(failing.calls).toHaveLength(2);
    const closed = new RetryProbe(first, [tlsFailure(tool), { ok: false, message: 'cant find runtimeid by projectpath' }]);
    await expect(closed.probeProjectClosed()).resolves.toBeUndefined();
    expect(closed.calls).toHaveLength(2);
  });
});

test('does not renew the original command deadline or reset global quota for a read retry', async () => {
  await withRateFixture(async ({ first, files }) => {
    const startedAt = Date.UTC(2026, 9, 7);
    let now = startedAt;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    class DeadlineProbe extends RetryProbe {
      async invoke(tool, args, context) {
        const envelope = await super.invoke(tool, args, context);
        now += this.commandTimeoutMs + 1;
        return envelope;
      }
    }
    const controller = new DeadlineProbe(first, [tlsFailure('automation_runtime_info'), { ok: true, result: {} }]);
    await expect(controller.runTool('automation_runtime_info', ['--project', first, '--action', 'currentPage']))
      .rejects.toThrow('Controller deadline exceeded');
    expect(controller.calls).toHaveLength(2);
    expect(controller.calls[1].context).toBe(controller.calls[0].context);
    expect(controller.calls[1].context.commandDeadlineAt).toBe(startedAt + controller.commandTimeoutMs);
    expect(now).toBe(controller.calls[1].context.commandDeadlineAt + 1);
    expect(controller.envelopes).toEqual([{ ok: true, result: {} }]);
    expect(JSON.parse(await readFile(files.state, 'utf8'))).toEqual([startedAt]);
  });
});

function reserveInHostProcess(projectPath, count) {
  const controllerUrl = new URL('../.wechat-test/runner/wechatide-controller.mjs', import.meta.url).href;
  const script = `import { WechatIdeController } from ${JSON.stringify(controllerUrl)};` +
    'const controller = new WechatIdeController(JSON.parse(process.argv[1]));' +
    'for(let index=0; index<Number(process.argv[2]); index++) await controller.reserveInvocationSlot();';
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script, JSON.stringify({ ...options, projectPath }), String(count)],
      { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let diagnostic = '';
    child.stderr.on('data', chunk => { diagnostic += String(chunk); });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`host quota process failed: ${diagnostic}`)));
  });
}

test('shares the 20 per 61s budget and lock across real host processes and project paths for one client/AppID', async () => {
  await withRateFixture(async ({ controller, first, second, files }) => {
    const peer = new WechatIdeController({ ...options, projectPath: second });
    expect(await peer.sharedRateFiles()).toEqual(files);
    await Promise.all([reserveInHostProcess(first, 7), reserveInHostProcess(second, 7)]);
    await Promise.all(Array.from({ length: 6 }, () => controller.reserveInvocationSlot()));
    const timestamps = JSON.parse(await readFile(files.state, 'utf8'));
    expect(timestamps).toHaveLength(20);
    expect(timestamps.every((value, index) => index === 0 || value >= timestamps[index - 1])).toBe(true);
    await expect(peer.reserveInvocationSlot(Date.now() + 1000)).rejects.toThrow('existing command deadline');
    expect(JSON.parse(await readFile(files.state, 'utf8'))).toEqual(timestamps);
    const now = timestamps.at(-1) + 61_001;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    await expect(peer.waitForFreshRateWindow()).resolves.toEqual({ waitedMs: 0 });
    // The fresh-window wait never deletes another process's history.
    expect(JSON.parse(await readFile(files.state, 'utf8'))).toEqual(timestamps);
    await peer.reserveInvocationSlot();
    expect(JSON.parse(await readFile(files.state, 'utf8'))).toEqual([now]);
  });
});

test('fails closed on malformed, oversized, future or unordered shared quota data', async () => {
  await withRateFixture(async ({ controller, files }) => {
    const now = Date.now();
    for (const text of ['not-json', '{}', JSON.stringify(['123']), JSON.stringify(Array(21).fill(now)),
      JSON.stringify([now + 60_000]), JSON.stringify([now, now - 1])]) {
      await writeFile(files.state, text);
      await expect(controller.reserveInvocationSlot()).rejects.toThrow('strict validation');
      expect(await readFile(files.state, 'utf8')).toBe(text);
    }
  });
});

test('preserves exact official TLS errors in native locator and wait after the one read recovery is exhausted', async () => {
  await withRateFixture(async ({ first }) => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    class CapturedProbe extends RetryProbe {
      async runTool(...args) {
        try { return await super.runTool(...args); }
        catch (error) { this.lastToolError = error; throw error; }
      }
    }
    for (const method of ['$', 'waitFor']) {
      const envelope = tlsFailure('automation_element_action');
      const controller = new CapturedProbe(first, [{ ok: true, result: { currentPage: { path: 'pages/home/index' } } },
        tlsFailure('automation_element_action'), envelope, { ok: true, result: { width: 44, height: 44 } }]);
      const page = await controller.currentPage();
      const failure = await page[method]('.device-row').then(() => null, error => error);
      expect(failure).toBeInstanceOf(WechatIdeToolError);
      expect(failure).toBe(controller.lastToolError);
      expect(failure.envelope).toBe(envelope);
      expect(controller.calls).toHaveLength(3);
    }
  });
});

test('keeps missing and zero-size native locators null and retains ordinary wait-for-visibility behavior', async () => {
  class MissingProbe extends WechatIdeController {
    constructor(responses) { super(options); this.responses = responses; this.sizeReads = 0; }
    async runTool(tool) {
      if (tool === 'automation_runtime_info') return { currentPage: { path: 'pages/home/index' } };
      this.sizeReads += 1;
      const response = this.responses.shift();
      if (response instanceof Error) throw response;
      return response;
    }
  }
  const nonexact = new WechatIdeToolError('automation_element_action', 'ordinary missing element',
    { ...tlsFailure('automation_element_action'), code: 'OTHER' });
  for (const response of [new Error('Element not found'), nonexact]) {
    const page = await new MissingProbe([response]).currentPage();
    await expect(page.$('.device-row')).rejects.toBe(response);
  }
  for (const response of [null, { width: 0, height: 0 }]) {
    const page = await new MissingProbe([response]).currentPage();
    await expect(page.$('.device-row')).resolves.toBeNull();
  }
  const controller = new MissingProbe([null, { width: 0, height: 44 }, { width: 44, height: 44 }]);
  const page = await controller.currentPage();
  await expect(page.waitFor('.device-row')).resolves.toBeTruthy();
  expect(controller.sizeReads).toBe(3);
});
