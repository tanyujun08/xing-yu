import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8');
const json = <T>(relativePath: string): T => JSON.parse(read(relativePath)) as T;
const hash = (relativePath: string) => createHash('sha256').update(readFileSync(join(root, relativePath))).digest('hex');

const safeActions = [
  'relaunch',
  'switch-tab',
  'tap',
  'tap-burst-10',
  'pull-down-refresh',
  'scroll-to-bottom',
] as const;
const runnerEnvKeys = [
  'XINGYU_WECHATIDE_COMMAND_PATH',
  'XINGYU_WECHATIDE_COMMAND_SHA256',
  'XINGYU_WECHATIDE_SKILL_VERSION',
  'XINGYU_WECHATIDE_SKILL_SHA256',
  'XINGYU_WECHAT_DEVTOOLS_VERSION',
  'XINGYU_WECHAT_DEVTOOLS_CHANNEL',
  'XINGYU_WECHAT_DEVTOOLS_MANIFEST_SHA256',
  'XINGYU_WECHATIDE_CLIENT_NAME',
  'XINGYU_WECHAT_WINDOWS_COMMAND_PATH',
  'XINGYU_WECHAT_WINDOWS_COMMAND_SHA256',
  // The optional CLI token is distinct from the independent MCP entrypoint credential.
  'XINGYU_WECHATIDE_CLI_TOKEN',
] as const;
const forbiddenPermissions = [
  'screenshot',
  'manualObservation',
  'accountSwitch',
  'businessWrite',
  'deviceStateChange',
] as const;
const readOnlyScenarioIds = [
  'detail-navigation',
  'home-load',
  'mock-input-binding',
  'pilot-layout-current-profile',
  'powder-ledger-read-controls',
  'tabbar-navigation',
] as const;
const boundedScenarioIds = [
  'loyalty-draw-flow',
  'coupon-redeem-flow',
  'profile-image-upload',
  'rental-asset-image-upload',
  'rental-asset-video-upload',
] as const;
const scenarioIds = [...readOnlyScenarioIds, ...boundedScenarioIds, 'order-ui-review'];
const adapterCapabilities = [
  'wechat-devtools',
  'wechatide-skill@0.3.11',
  'controller:wechatide-mcp',
  'data-mode:local-api',
  'api-identity:local-api:127.0.0.1:8081',
  'devtools:domain-check-disabled',
  ...safeActions.map((action) => `action:${action}`),
  'mutation:read-only-or-loyalty-case-bound',
  'layout-matrix:single-profile-observed',
  'action:native-material-choose-once',
  'action:material-save-once',
  'action:material-anonymous-read',
  'mutation:material-case-bound',
  'file-input:human-native-chooser-once',
  'action:order-ui-review',
];
const scenarioTimeBudgets = {
  'detail-navigation': 120,
  'home-load': 120,
  'mock-input-binding': 60,
  'pilot-layout-current-profile': 60,
  'powder-ledger-read-controls': 360,
  'tabbar-navigation': 150,
} as const;

type Adapter = {
  schemaVersion: string;
  adapterVersion: string;
  runners: Array<{ id: string; argvTemplate: string[]; envKeys: string[]; capabilities: string[] }>;
  capabilities: string[];
};
type Catalog = {
  catalogVersion: string;
  scenarios: Array<{ id: string; path: string; sha256: string }>;
};
type Scenario = {
  id: string;
  targetPages: Array<{ route: string; entryMode: string; parameterKeys: string[] }>;
  session: { mode: 'none' | 'required'; expectedRole: string | null; expectedScope: string | null };
  runtime: { channel: string; runnerId: string; requiredTools: string[] };
  preconditions: Array<{ id: string; required: boolean }>;
  fixture: { id: string; sourceRef: string; resetAuthorized: boolean } | null;
  permissions: Record<string, boolean | string[]>;
  writePolicy: unknown;
  steps: Array<{ action: string; target: { value: string }; mutationClass: string; idempotencyStrategy: unknown }>;
  assertions: Array<{ id: string; severity: string }>;
  evidencePolicy: { screenshots: string; console: string; network: string; trace: boolean; video: boolean };
  timeBudgetSeconds: number;
};
type LayoutCapability = {
  overallStatus: string;
  automatedCurrentProfileChecks: string[];
  matrix: Array<{ viewportWidth: number; fontScalePercent: number; safeAreaBottomPx: number; status: string }>;
  claimBoundary: string;
};

describe('WeChat M3 product test contract', () => {
  test('keeps one canonical runner entry and binds it to exact package capabilities', () => {
    const adapter = json<Adapter>('.wechat-test/project.json');
    const packageManifest = json<{ devDependencies: Record<string, string> }>('package.json');
    expect(adapter.schemaVersion).toBe('2.0');
    expect(adapter.adapterVersion).toBe('1.4.0');
    expect(adapter.runners).toHaveLength(1);
    expect(adapter.runners[0]?.id).toBe('xingyu-wechatide-nightly');
    expect(adapter.runners[0]?.argvTemplate.slice(0, 2)).toEqual([
      'node',
      'xingyu-miniprogram/.wechat-test/runner/run-test.mjs',
    ]);
    expect(adapter.runners[0]?.envKeys).toEqual(runnerEnvKeys);
    expect(packageManifest.devDependencies['miniprogram-automator']).toBe('0.12.1');
    expect(adapter.capabilities).toEqual(adapterCapabilities);
    expect(adapter.runners[0]?.capabilities).toEqual(adapterCapabilities);

    expect(read('.wechat-test/runner/run-test.mjs')).toBe(
      "import { runReadOnlyTest } from './run-readonly-test.mjs';\n\nawait runReadOnlyTest();\n",
    );
    expect(read('.wechat-test/runner/run-readonly-test.mjs')).toContain('export async function runReadOnlyTest');
    expect(read('.wechat-test/runner/run-readonly-test.mjs')).not.toContain('await main()');
  });

  test('rejects missing, extra, or duplicate runner environment identities', () => {
    const moduleUrl = pathToFileURL(join(root, '.wechat-test/runner/runtime-contract.mjs')).href;
    const adapterPath = join(root, '.wechat-test/project.json');
    const probe = `
      import assert from 'node:assert/strict';
      import { readFile } from 'node:fs/promises';
      import { assertLocalApiRequestSafety } from ${JSON.stringify(moduleUrl)};
      const adapter = JSON.parse(await readFile(${JSON.stringify(adapterPath)}, 'utf8'));
      const request = {
        environment: { id: 'local-demo', apiIdentity: 'local-api:127.0.0.1:8081' },
        testPlan: { selectedScenarioIds: ['pilot-layout-current-profile'] },
        authorization: {
          // The local-api channel must be able to reach the development API, so a request that
          // forbids network access is the drift case now.
          devtoolsLifecycle: true, runtimeRead: true, networkAccess: true, screenshot: false,
          manualObservation: false, loginAction: false, accountSwitch: false, businessWrite: false,
          testDataMutation: false, deviceStateChange: false,
        },
        execution: { maxParallelScenarios: 1, isolatedRuntimePerScenario: true, readRetryLimit: 0, writeRetryLimit: 0 },
      };
      assert.doesNotThrow(() => assertLocalApiRequestSafety(request, adapter));
      // The request envelope must authorize loginAction exactly when the selection contains one of
      // the reviewed WeChat login screens, and must refuse it otherwise.
      const withLogin = structuredClone(request);
      withLogin.testPlan = { selectedScenarioIds: ['powder-ledger-read-controls'] };
      withLogin.authorization.loginAction = true;
      assert.doesNotThrow(() => assertLocalApiRequestSafety(withLogin, adapter));
      const loginWithoutLoginScenario = structuredClone(withLogin);
      // A scenario that never signs in must not receive the login authorization.
      loginWithoutLoginScenario.testPlan = { selectedScenarioIds: ['pilot-layout-current-profile'] };
      assert.throws(() => assertLocalApiRequestSafety(loginWithoutLoginScenario, adapter), /loginAction must be false/);
      const loginScenarioWithoutGrant = structuredClone(withLogin);
      loginScenarioWithoutGrant.authorization.loginAction = false;
      assert.throws(() => assertLocalApiRequestSafety(loginScenarioWithoutGrant, adapter), /loginAction must be true/);
      const deniedMutationRequest = structuredClone(request);
      // The local-api channel declares no test-data mutation, so announcing one is the drift case.
      deniedMutationRequest.authorization.testDataMutation = true;
      assert.throws(() => assertLocalApiRequestSafety(deniedMutationRequest, adapter), /test-data mutation/);
      for (const selectedScenarioIds of [[], ['orders-read-controls'], ['home-load', 'home-load']]) {
        const changed = structuredClone(request);
        changed.testPlan.selectedScenarioIds = selectedScenarioIds;
        assert.throws(() => assertLocalApiRequestSafety(changed, adapter), /unreviewed or retired scenario/);
      }
      for (const mutate of [
        (copy) => { copy.runners[0].envKeys.pop(); },
        (copy) => { copy.runners[0].envKeys.push('XINGYU_UNREVIEWED'); },
        (copy) => { copy.runners[0].envKeys.push(copy.runners[0].envKeys[0]); },
      ]) {
        const changed = structuredClone(adapter);
        mutate(changed);
      assert.throws(() => assertLocalApiRequestSafety(request, changed), /fixed reviewed wechatide runner/);
      }
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  test('binds all twelve catalog entries to exact scenario bytes', () => {
    const catalog = json<Catalog>('.wechat-test/catalog.json');
    expect(catalog.catalogVersion).toBe('1.4.0');
    expect(catalog.scenarios.map((entry) => entry.id)).toEqual(scenarioIds);
    for (const entry of catalog.scenarios) {
      const productRelativePath = entry.path.replace(/^xingyu-miniprogram\//u, '');
      expect(hash(productRelativePath), entry.id).toBe(entry.sha256);
    }
  });

  test('keeps all six Node test suites outside Vitest and in the native test command', () => {
    const packageManifest = json<{ scripts: { test: string } }>('package.json');
    const suites = ['loyalty-runtime', 'material-upload-runtime', 'rental-ui-runtime', 'order-ui-read-routes', 'rental-ui-controller', 'owned-process']
      .map((name) => `.wechat-test/runner/${name}.test.mjs`);
    expect(packageManifest.scripts.test).toBe(`vitest run && node --test ${suites.join(' ')}`);
    for (const suite of suites) {
      expect(read('vitest.config.ts')).toContain(`'${suite}'`);
      expect(read(suite)).toContain("from 'node:test'");
    }
  });

  test('binds order UI review to existing-session reads and an unsubmitted local draft', () => {
    const scenario = json<Scenario>('.wechat-test/scenarios/order-ui-review.json');
    const expectedPages = [
      { route: 'pages/orders/index', entryMode: 'relaunch', parameterKeys: [] },
      { route: 'pages/device-orders/index', entryMode: 'relaunch', parameterKeys: ['assetId'] },
      { route: 'pages/order-detail/index', entryMode: 'relaunch', parameterKeys: ['orderId'] },
      { route: 'pages/contract/index', entryMode: 'relaunch', parameterKeys: ['orderId'] },
      { route: 'pages/return-submit/index', entryMode: 'relaunch', parameterKeys: ['orderId'] },
      { route: 'pages/identity/index', entryMode: 'relaunch', parameterKeys: [] },
      { route: 'pages/cabinet-code/index', entryMode: 'relaunch', parameterKeys: ['scene'] },
      { route: 'pages/wallet/index', entryMode: 'relaunch', parameterKeys: [] },
      { route: 'pages/confirm/index', entryMode: 'relaunch', parameterKeys: ['orderId'] },
      { route: 'pages/cabinets/index', entryMode: 'relaunch', parameterKeys: ['mode', 'orderId'] },
      { route: 'pages/cabinet-detail/index', entryMode: 'relaunch', parameterKeys: ['mode', 'orderId', 'id'] },
      { route: 'pages/cabinet-return/index', entryMode: 'relaunch', parameterKeys: ['orderId'] },
      { route: 'pages/cabinet-open/index', entryMode: 'relaunch', parameterKeys: ['taskId'] },
      { route: 'pages/detail/index', entryMode: 'relaunch', parameterKeys: ['id'] },
      { route: 'pages/order-fees/index', entryMode: 'relaunch', parameterKeys: ['orderId'] },
      { route: 'pages/info/index', entryMode: 'relaunch', parameterKeys: [] },
    ];
    expect(scenario.targetPages).toEqual(expectedPages);
    expect(scenario.runtime).toEqual({
      channel: 'wechatide-mcp', runnerId: 'xingyu-wechatide-nightly',
      requiredTools: ['wechat-devtools', 'wechatide-skill@0.3.11'],
    });
    expect(scenario.session).toEqual({ mode: 'required', expectedRole: 'LESSOR', expectedScope: 'own-order' });
    expect(scenario.fixture).toEqual({
      id: 'xingyu-rental-ui-local-order',
      sourceRef: 'xingyu-miniprogram/.wechat-test/fixtures/rental-ui-local-api.json', resetAuthorized: false,
    });
    expect(scenario.permissions).toEqual({
      pages: expectedPages.map((page) => page.route),
      navigation: true, elementRead: true, devtoolsLifecycle: true, runtimeRead: true,
      networkAccess: true, screenshot: true, manualObservation: false, loginAction: false,
      accountSwitch: false, businessWrite: false, testDataMutation: false, deviceStateChange: false,
    });
    expect(scenario.writePolicy).toBeNull();
    expect(scenario.steps.map((step) => [step.action, step.target.value])).toEqual([
      ['relaunch', 'pages/order-detail/index'], ['screenshot', 'rental-ui:order'],
      ['input-draft', 'input[data-field=trackingInput]'], ['tap', '#shipment-sheet #sheet-page-header .page-header__back'],
      ['screenshot', 'rental-ui:routes'],
    ]);
    expect(scenario.steps.every((step) => step.mutationClass === 'none' && step.idempotencyStrategy === null)).toBe(true);
    expect(scenario.assertions.map((assertion) => assertion.id)).toEqual([
      'fixture-matches', 'profile-observed', 'draft-input-preserved', 'closed-to-original-order',
      'screenshots-and-measurements', 'prepared-routes-captured',
    ]);
    expect(scenario.assertions.every((assertion) => assertion.severity === 'REQUIRED')).toBe(true);
    expect(scenario.timeBudgetSeconds).toBe(1200);
    expect(scenario.evidencePolicy).toMatchObject({
      screenshots: 'required-only', console: 'none', network: 'none', trace: false, video: false,
    });
    const moduleUrl = pathToFileURL(join(root, '.wechat-test/runner/rental-ui-runtime.mjs')).href;
    const probe = `
      import assert from 'node:assert/strict';
      import { canonicalRentalUiScenario, assertRentalUiScenarioSafety } from ${JSON.stringify(moduleUrl)};
      const scenario = ${JSON.stringify(scenario)};
      assert.deepEqual(canonicalRentalUiScenario().targetPages, ${JSON.stringify(expectedPages)});
      assert.doesNotThrow(() => assertRentalUiScenarioSafety(scenario));
      for (const route of ['pages/home/index', 'pages/addresses/index', 'pages/address-edit/index', 'pages/unknown/index']) {
        const changed = structuredClone(scenario);
        changed.targetPages.push({ route, entryMode: 'relaunch', parameterKeys: [] });
        changed.permissions.pages.push(route);
        assert.throws(() => assertRentalUiScenarioSafety(changed), /exact bounded contract/);
      }
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
      cwd: root, encoding: 'utf8', windowsHide: true,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  test('keeps six read-only and five bounded scenarios inside their exact permissions', () => {
    const runner = read('.wechat-test/runner/run-readonly-test.mjs');
    expect(runner).not.toMatch(/prepareMockSession|restoreMockSession|callWxWithArgsFile|setStorageSync|removeStorageSync/u);
    expect(safeActions).not.toContain('prepare-mock-session');
    for (const id of readOnlyScenarioIds) {
      const scenario = json<Scenario>(`.wechat-test/scenarios/${id}.json`);
      expect(scenario.runtime).toEqual({
        channel: 'wechatide-mcp',
        runnerId: 'xingyu-wechatide-nightly',
        requiredTools: ['wechat-devtools', 'wechatide-skill@0.3.11'],
      });
      // Derive the expected session from the scenario's own reviewed steps: exactly the scenarios that
      // tap the reviewed WeChat login control may declare a required session.
      const requiresLogin = scenario.steps.some((step) => step.action === 'tap' && step.target.value === '.quick-button');
      expect(scenario.session).toEqual(requiresLogin
        // The local-api channel signs in with a real WeChat session, so the scenario binds no
        // synthetic tenant role or scope: it only requires a session.
        ? { mode: 'required', expectedRole: null, expectedScope: null }
        : { mode: 'none', expectedRole: null, expectedScope: null });
      expect(scenario.assertions.length).toBeGreaterThan(0);
      expect(new Set(scenario.assertions.map((assertion) => assertion.id)).size).toBe(scenario.assertions.length);
      expect(scenario.assertions.every((assertion) => assertion.severity === 'REQUIRED')).toBe(true);
      expect(scenario.preconditions.map((item) => item.id)).toEqual([
        'candidate-match',
        'local-api-environment',
        'dev-data-read-only',
        'read-only-permissions',
      ]);
      expect(scenario.preconditions.every((item) => item.required)).toBe(true);
      expect(scenario.fixture).toEqual({
        id: 'xingyu-dev-api-seed',
        sourceRef: 'xingyu-governance/seeds/v1.0.1.3/scenario-seed.sql',
        resetAuthorized: false,
      });
      // The local-api channel declares no client-side write policy at all: writes are owned by the
      // real intake API, so a scenario that announced one would be drift.
      expect(scenario.writePolicy).toBeNull();
      for (const permission of forbiddenPermissions) expect(scenario.permissions[permission], `${id}/${permission}`).toBe(false);
      // Scenes that require a session sign in through the real WeChat path, so loginAction must be
      // enabled there and stay disallowed everywhere else.
      expect(scenario.permissions.loginAction).toBe(requiresLogin);
      // The local-api channel writes through the real intake API, so no scenario may declare
      // client-side test-data mutation.
      expect(scenario.permissions.testDataMutation).toBe(false);
      expect(scenario.timeBudgetSeconds).toBe(scenarioTimeBudgets[id]);
      expect(scenario.permissions.navigation).toBe(true);
      expect(scenario.permissions.elementRead).toBe(true);
      expect(scenario.permissions.devtoolsLifecycle).toBe(true);
      expect(scenario.permissions.runtimeRead).toBe(true);
      // The local-api channel prepares no synthetic session, so every step is a read-only host
      // gesture and any `prepare-mock-session` step is itself the drift this loop rejects.
      for (const [index, step] of scenario.steps.entries()) {
        const stepLabel = `${id}#${index}/${step.action}`;
        expect(safeActions, stepLabel).toContain(step.action);
        expect(step.action, stepLabel).not.toBe('prepare-mock-session');
        expect(step.mutationClass, stepLabel).toBe('none');
        expect(step.idempotencyStrategy, stepLabel).toBeNull();
      }
      expect(scenario.evidencePolicy).toMatchObject({
        screenshots: 'none',
        console: 'none',
        network: 'none',
        trace: false,
        video: false,
      });
    }
    const moduleUrl = pathToFileURL(join(root, '.wechat-test/runner/runtime-contract.mjs')).href;
    const probe = `
      import assert from 'node:assert/strict';
      import { readFile } from 'node:fs/promises';
      import { assertScenarioSafety } from ${JSON.stringify(moduleUrl)};
      for (const id of ${JSON.stringify(boundedScenarioIds)}) {
        const scenario = JSON.parse(await readFile(${JSON.stringify(join(root, '.wechat-test/scenarios'))} + '/' + id + '.json', 'utf8'));
        assert.doesNotThrow(() => assertScenarioSafety(scenario));
        assert.deepEqual(scenario.session, { mode: 'required', expectedRole: null, expectedScope: null });
        assert.equal(scenario.writePolicy.maxAttempts, 1);
        assert.equal(scenario.writePolicy.idempotencyRequired, true);
        assert.equal(scenario.permissions.businessWrite, true);
        assert.equal(scenario.permissions.testDataMutation, true);
        assert.equal(scenario.permissions.screenshot, true);
        assert.equal(scenario.timeBudgetSeconds, 360);
        assert.equal(scenario.assertions.every(item => item.severity === 'REQUIRED'), true);
        for (const permission of ['manualObservation', 'accountSwitch', 'deviceStateChange']) assert.equal(scenario.permissions[permission], false);
        for (const mutate of [
          copy => { copy.writePolicy.maxAttempts = 2; },
          copy => { copy.writePolicy.idempotencyRequired = false; },
          copy => { copy.permissions.businessWrite = false; },
          copy => { copy.permissions.screenshot = false; },
          copy => { copy.assertions[0].severity = 'OPTIONAL'; },
        ]) {
          const changed = structuredClone(scenario); mutate(changed);
          assert.throws(() => assertScenarioSafety(changed));
        }
        const material = id.endsWith('-upload');
        assert.equal(scenario.steps.filter(step => step.mutationClass === 'business-write').length, material ? 2 : 1);
        if (material) {
          for (const action of ['native-material-choose-once', 'material-save-once', 'material-anonymous-read']) {
            assert.equal(scenario.steps.filter(step => step.action === action).length, 1);
          }
        }
      }
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  test('uses only the exact host gestures and the reviewed wechatide controller path', () => {
    const runner = read('.wechat-test/runner/run-readonly-test.mjs');
    expect(runner.match(/\.callWxMethod\(/gu)).toHaveLength(2);
    expect(runner).toContain("miniProgram.callWxMethod('startPullDownRefresh')");
    expect(runner).toContain("miniProgram.callWxMethod('getAccountInfoSync')");
    expect(runner.match(/\.pageScrollTo\(/gu)).toHaveLength(1);
    expect(runner).toContain('miniProgram.pageScrollTo(1_000_000)');
    expect(runner).not.toMatch(/\.callMethod\s*\(/u);
    expect(runner).not.toMatch(/\.evaluate\s*\(/u);
    expect(runner).not.toMatch(/\.setData\s*\(/u);
    expect(runner).not.toMatch(/\brequest\s*\(/u);
    expect(runner).not.toMatch(/\.screenshot\s*\(/u);
    expect(runner).toContain('new WechatIdeController({');
    expect(runner).toContain('await miniProgram.open()');
    expect(runner).toContain('await miniProgram.close()');
    expect(runner).not.toContain('automator.connect');
    expect(runner).not.toContain('fallbackController');
  });

  test('emits .NET-safe canonical UTC timing from one normalized epoch pair', () => {
    const moduleUrl = pathToFileURL(join(root, '.wechat-test/runner/run-readonly-test.mjs')).href;
    const probe = `
      import assert from 'node:assert/strict';
      import { buildCanonicalTiming, formatCanonicalDateTime } from ${JSON.stringify(moduleUrl)};
      const timing = buildCanonicalTiming(
        Date.parse('2026-09-01T21:22:16.512Z'),
        Date.parse('2026-09-01T21:22:48.817Z'),
      );
      assert.deepEqual(timing, {
        startedAt: '2026-09-01T21:22:16.000+00:00',
        finishedAt: '2026-09-01T21:22:48.000+00:00',
        durationMs: 32_000,
      });
      assert.equal(Date.parse(timing.finishedAt) - Date.parse(timing.startedAt), timing.durationMs);
      assert.equal(formatCanonicalDateTime(Date.parse('2026-09-01T21:22:16.999Z')), '2026-09-01T21:22:16.000+00:00');
      assert.throws(() => buildCanonicalTiming(2_000, 1_000), /finished before it started/);
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    const runner = read('.wechat-test/runner/run-readonly-test.mjs');
    expect(runner).toContain('const startedAt = iso(startedMs);');
    expect(runner).toContain('evidence.timing = buildCanonicalTiming(startedMs, Date.now());');
    expect(runner).toContain('modifiedAt: iso(artifactStat.mtimeMs)');
  });

  test('constructs an injection-safe exact DevTools launch command on Windows and keeps non-Windows shell-free', () => {
    const moduleUrl = pathToFileURL(join(root, '.wechat-test/runner/runtime-contract.mjs')).href;
    const windowsCli = String.raw`C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat`;
    const windowsProject = String.raw`C:\xy-change-workspaces\XY-20260901\xingyu-miniprogram`;
    const windowsCommand = String.raw`C:\Windows\System32\cmd.exe`;
    const probe = `
      import assert from 'node:assert/strict';
      import { buildDevToolsLaunchCommand, isFailedDevToolsLaunchExit } from ${JSON.stringify(moduleUrl)};
      const windowsCli = ${JSON.stringify(windowsCli)};
      const windowsProject = ${JSON.stringify(windowsProject)};
      const windowsCommand = ${JSON.stringify(windowsCommand)};
      const windows = buildDevToolsLaunchCommand({
        platform: 'win32', cliPath: windowsCli, projectPath: windowsProject,
        servicePort: 43210, windowsCommandPath: windowsCommand,
      });
      assert.equal(windows.command, windowsCommand);
      assert.deepEqual(windows.args, [
        '/d', '/s', '/v:off', '/c',
        'call "' + windowsCli + '" auto --project "' + windowsProject + '" --auto-port 43210',
      ]);
      assert.deepEqual(windows.spawnOptions, {
        shell: false, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true,
      });
      assert.equal(windows.args.join(' ').includes(' preview '), false);
      assert.equal(windows.args.join(' ').includes(' upload '), false);
      assert.equal(windows.args.join(' ').includes('--trust-project'), false);
      for (const unsafe of ['&', '|', '<', '>', '^', '%', '!', '"', '\\n']) {
        assert.throws(() => buildDevToolsLaunchCommand({
          platform: 'win32', cliPath: windowsCli,
          projectPath: 'C:\\\\project' + unsafe + 'whoami', servicePort: 43210,
          windowsCommandPath: windowsCommand,
        }), /without cmd metacharacters/);
      }
      assert.throws(() => buildDevToolsLaunchCommand({
        platform: 'win32', cliPath: 'C:\\\\tool\\\\cli.exe', projectPath: windowsProject,
        servicePort: 43210, windowsCommandPath: windowsCommand,
      }), /exact cli.bat and cmd.exe/);
      const posix = buildDevToolsLaunchCommand({
        platform: 'linux', cliPath: '/opt/wechat/cli', projectPath: '/tmp/project & literal',
        servicePort: 43210,
      });
      assert.equal(posix.command, '/opt/wechat/cli');
      assert.deepEqual(posix.args, ['auto', '--project', '/tmp/project & literal', '--auto-port', '43210']);
      assert.equal(posix.spawnOptions.shell, false);
      assert.equal(posix.spawnOptions.windowsVerbatimArguments, false);
      assert.equal(isFailedDevToolsLaunchExit(null), false);
      assert.equal(isFailedDevToolsLaunchExit({ code: null, signal: null }), false);
      assert.equal(isFailedDevToolsLaunchExit({ code: 0, signal: null }), false);
      assert.equal(isFailedDevToolsLaunchExit({ code: 1, signal: null }), true);
      assert.equal(isFailedDevToolsLaunchExit({ code: null, signal: 'SIGTERM' }), true);
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  test('constructs and parses the exact wechatide command envelope without a shell fallback', () => {
    const moduleUrl = pathToFileURL(join(root, '.wechat-test/runner/wechatide-controller.mjs')).href;
    const commandPath = String.raw`C:\Program Files (x86)\Tencent\微信web开发者工具\wechatide.cmd`;
    const windowsCommandPath = String.raw`C:\Windows\System32\cmd.exe`;
    const probe = `
      import assert from 'node:assert/strict';
      import { buildWechatIdeInvocation, parseWechatIdeEnvelope, WechatIdeController } from ${JSON.stringify(moduleUrl)};
      const commandPath = ${JSON.stringify(commandPath)};
      const windowsCommandPath = ${JSON.stringify(windowsCommandPath)};
      const invocation = buildWechatIdeInvocation({
        commandPath, windowsCommandPath, clientName: 'Codex', tool: 'check_wechatide_status',
        args: ['--skill-version', '0.3.11'], platform: 'win32', cliToken: 'synthetic-envelope-token',
      });
      assert.equal(invocation.command, windowsCommandPath);
      const forwardSlashInvocation = buildWechatIdeInvocation({
        commandPath, windowsCommandPath: windowsCommandPath.replaceAll(String.fromCharCode(92), '/'),
        clientName: 'Codex', tool: 'check_wechatide_status', args: ['--skill-version', '0.3.11'],
        platform: 'win32', cliToken: 'synthetic-envelope-token',
      });
      assert.deepEqual(forwardSlashInvocation, invocation);
      assert.equal(invocation.args[4], 'call "' + commandPath + '" -c "Codex" "check_wechatide_status" "--skill-version" "0.3.11" "--token=synthetic-envelope-token"');
      assert.deepEqual(invocation.args.slice(0, 4), ['/d', '/s', '/v:off', '/c']);
      assert.equal(invocation.spawnOptions.shell, false);
      assert.equal(invocation.args.join(' ').includes('wechatide.cmd'), true);
      assert.equal(invocation.args.join(' ').includes('0.3.11'), true);
      const noTokenInvocation = buildWechatIdeInvocation({
        commandPath, windowsCommandPath, clientName: 'Codex', tool: 'check_wechatide_status',
        args: ['--skill-version', '0.3.11'], platform: 'win32',
      });
      assert.equal(noTokenInvocation.args[4], 'call "' + commandPath + '" -c "Codex" "check_wechatide_status" "--skill-version" "0.3.11"');
      for (const cliToken of [123, 'unsafe&token', 'unsafe"token']) {
        assert.throws(() => buildWechatIdeInvocation({
          commandPath, windowsCommandPath, clientName: 'Codex', tool: 'check_wechatide_status',
          args: ['--skill-version', '0.3.11'], platform: 'win32', cliToken,
        }), /token must be a string|prohibited Windows command character/);
      }
      assert.throws(() => buildWechatIdeInvocation({
        commandPath, windowsCommandPath, clientName: 'Codex', tool: 'open_project_window',
        args: ['--project', 'C:\\project&whoami'], platform: 'win32', cliToken: 'synthetic-envelope-token',
      }), /prohibited Windows command character/);
      assert.deepEqual(
        parseWechatIdeEnvelope('bootstrap line\\n{"ok":true,"result":{"success":true}}'),
        { ok: true, result: { success: true } },
      );
      assert.throws(() => parseWechatIdeEnvelope('no terminal envelope'), /terminal JSON envelope/);
      class ProbeController extends WechatIdeController {
        constructor(envelope) {
          super({ commandPath, windowsCommandPath, projectPath: 'C:\\project', clientName: 'Codex', cliToken: 'synthetic-envelope-token' });
          this.envelope = envelope;
        }
        async invoke() { return this.envelope; }
      }
      assert.equal(await new ProbeController({ ok: true, result: '12345' }).runTool('automation_element_action'), '12345');
      assert.deepEqual(
        await new ProbeController({ ok: true, result: { success: true, width: 390 } }).runTool('automation_element_action'),
        { success: true, width: 390 },
      );
      await assert.rejects(
        new ProbeController({ ok: true, result: { success: false } }).runTool('automation_element_action'),
        /did not report success/,
      );
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const controller = read('.wechat-test/runner/wechatide-controller.mjs');
    expect(controller).toContain("runTool('check_wechatide_status'");
    expect(controller).toContain("runTool('open_project_window'");
    expect(controller).toContain("runTool('close_project_window'");
    expect(controller).toContain('const WECHATIDE_RATE_WINDOW_MS = 61_000;');
    expect(controller).toContain('const WECHATIDE_RATE_BUDGET = 20;');
    expect(controller).toContain('async waitForFreshRateWindow()');
    expect(read('.wechat-test/runner/run-readonly-test.mjs').match(/await miniProgram\.waitForFreshRateWindow\(\);/gu)).toHaveLength(2);
    expect(controller).toContain("'--wait-for-selector', this.selector");
    expect(controller).toContain('result.winId !== expectedWinId');
    expect(controller).toContain('async captureLoyaltyPage(filename)');
    expect(controller).toContain('async captureMaterialPage(filename)');
    expect(controller).toContain('!isLoyaltyScenario(this.loyaltyScenarioId) || this.readRetryLimit !== 0 || !this.artifactRoot');
    expect(controller).toContain('const spec = MATERIAL_CASES[this.materialScenarioId]');
    expect(controller).toContain('!spec || this.readRetryLimit !== 0 || !this.artifactRoot');
    expect(controller).toContain('Screenshot overwrite is forbidden');
    expect(controller).toContain('Screenshot output is outside the physical artifact root');
    expect(controller).toContain('Screenshot current page differs from the authorized loyalty page');
    expect(controller).toContain('Material screenshot output escaped its fixed artifact root');
    expect(controller).toContain('Material screenshot page is outside its exact case');
    expect(controller).toContain('async captureRentalUiPage(filename, orderId)');
    expect(controller).toContain('async captureOrderUiRoute(filename, sample)');
    expect(controller.match(/runTool\('simulator_screenshot',[^\n]*'--optimize',\s*'false'/gu)).toHaveLength(4);
  });

  test('binds cmd.exe to the governance path and hash without trusting mutable Windows roots', () => {
    const moduleUrl = pathToFileURL(join(root, '.wechat-test/runner/run-readonly-test.mjs')).href;
    const probe = `
      import assert from 'node:assert/strict';
      import { createHash } from 'node:crypto';
      import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
      import { tmpdir } from 'node:os';
      import path from 'node:path';
      import { resolveWindowsCommandIdentity } from ${JSON.stringify(moduleUrl)};
      const fixtureRoot = await realpath(await mkdtemp(path.join(tmpdir(), 'xingyu-command-identity-')));
      const originalSystemRoot = process.env.SystemRoot;
      const originalComSpec = process.env.ComSpec;
      const normalize = (value) => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
      try {
        const approvedPath = path.join(fixtureRoot, 'approved', 'cmd.exe');
        const fakePath = path.join(fixtureRoot, 'fake', 'cmd.exe');
        await mkdir(path.dirname(approvedPath), { recursive: true });
        await mkdir(path.dirname(fakePath), { recursive: true });
        const approvedBytes = Buffer.from('reviewed-command-bytes', 'utf8');
        await writeFile(approvedPath, approvedBytes);
        await writeFile(fakePath, approvedBytes);
        const approvedIdentity = {
          path: approvedPath,
          sha256: createHash('sha256').update(approvedBytes).digest('hex'),
        };
        process.env.SystemRoot = path.dirname(path.dirname(fakePath));
        process.env.ComSpec = fakePath;
        const resolvedIdentity = await resolveWindowsCommandIdentity(approvedPath, approvedIdentity);
        assert.equal(normalize(resolvedIdentity.path), normalize(approvedPath));
        assert.equal(resolvedIdentity.sha256, approvedIdentity.sha256);
        await assert.rejects(
          resolveWindowsCommandIdentity(fakePath, resolvedIdentity),
          /physical path drifted/,
        );
        await writeFile(approvedPath, Buffer.from('drifted-command-bytes', 'utf8'));
        await assert.rejects(
          resolveWindowsCommandIdentity(approvedPath, resolvedIdentity),
          /SHA-256 drifted/,
        );
      } finally {
        if (originalSystemRoot === undefined) delete process.env.SystemRoot;
        else process.env.SystemRoot = originalSystemRoot;
        if (originalComSpec === undefined) delete process.env.ComSpec;
        else process.env.ComSpec = originalComSpec;
        await rm(fixtureRoot, { recursive: true, force: true });
      }
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const runner = read('.wechat-test/runner/run-readonly-test.mjs');
    expect(runner).not.toMatch(/process\.env\.(?:SystemRoot|ComSpec|COMSPEC)/u);
  });

  test('keeps native ledger filter and login component guards while retaining the order page shell', () => {
    const runner = read('.wechat-test/runner/run-readonly-test.mjs');
    expect(read('miniprogram/pages/login/index.wxml')).toContain('<login-sheet id="login-sheet"');
    const loginWxml = read('miniprogram/components/login-sheet/index.wxml');
    const ledgerSource = read('miniprogram/pages/powder-ledger/index.ts');
    const ledgerController = read('miniprogram/shared/interaction/account-ledger-page.ts');
    expect(runner).toContain("element.attribute('data-filter')");
    expect(runner).toContain('before.filter !== expectedFilter && after.filter === expectedFilter');
    expect(read('miniprogram/pages/orders/index.wxml')).toContain('class="xy-button-reset filter-chip {{filter === item.id');
    expect(read('miniprogram/pages/orders/index.wxml')).toContain('data-filter="{{item.id}}"');
    const ledgerMarkup = read('miniprogram/pages/powder-ledger/index.wxml');
    expect(ledgerMarkup).toMatch(/<section-tabs\b[^>]*class="ledger-tabs-control"/u);
    expect(ledgerMarkup).toContain('value="{{ledgerFilter}}"');
    expect(ledgerMarkup).toContain('bindchange="setLedgerFilter"');
    const tabMarkup = read('miniprogram/components/section-tabs/index.wxml');
    expect(tabMarkup).toMatch(/<button\b[^>]*class="section-tabs__hit[^>]*data-value="\{\{item\.id\}\}"[^>]*bindtap="onSelect"/u);
    expect(tabMarkup).toContain('aria-selected="{{value === item.id}}"');
    expect(json<{ enablePullDownRefresh: boolean; onReachBottomDistance: number }>('miniprogram/pages/orders/index.json')).toMatchObject({ enablePullDownRefresh: true, onReachBottomDistance: 120 });
    expect(json<{ enablePullDownRefresh: boolean; onReachBottomDistance: number }>('miniprogram/pages/powder-ledger/index.json')).toMatchObject({ enablePullDownRefresh: true, onReachBottomDistance: 120 });
    expect(ledgerSource).toContain('createAccountLedgerPage');
    expect(ledgerController).toMatch(/async onPullDownRefresh\(/u);
    expect(ledgerController).toMatch(/onReachBottom\(/u);
    for (const selector of [
      'login-overlay',
      'login-sheet',
      'quick-button',
      'phone-button',
      'guest-button',
      'agreement-row',
      'login-heading',
      'login-copy',
      'agreement-text',
    ]) expect(loginWxml, selector).toContain(`class="${selector}`);
  });

  test('declares all 24 layout tuples BLOCKED before exact runtime identity exists', () => {
    const capability = json<LayoutCapability>('.wechat-test/capabilities/layout-matrix.json');
    expect(capability.overallStatus).toBe('BLOCKED');
    expect(capability.automatedCurrentProfileChecks).toEqual([]);
    // The approved layout matrix is 320/375/390/430 x 100/150/200 x 0/34 = 24 tuples; the earlier
    // 18-tuple expectation predates the M19 matrix extension.
    expect(capability.matrix).toHaveLength(24);
    expect(new Set(capability.matrix.map((row) => `${row.viewportWidth}/${row.fontScalePercent}/${row.safeAreaBottomPx}`)).size).toBe(24);
    expect(capability.matrix.every((row) => row.status === 'BLOCKED')).toBe(true);
    expect(capability.matrix.some((row) => row.status === 'PASS')).toBe(false);
    // The declaration keeps its "no row is evidence / no full-matrix PASS" boundary, phrased as the
    // reviewed capability file states it today.
    expect(capability.claimBoundary).toContain('no row is evidence');
    expect(capability.claimBoundary).toContain('BLOCKED');
  });

  test('binds the wechatide runtime before treating one current profile as OBSERVED', () => {
    const moduleUrl = pathToFileURL(join(root, '.wechat-test/runner/runtime-contract.mjs')).href;
    const probe = `
      import assert from 'node:assert/strict';
      import { buildWechatIdeRuntime, buildLayoutCapability, layoutProfileBlocker } from ${JSON.stringify(moduleUrl)};
      const prelaunch = { channel: 'none', controllerIdentity: null, servicePort: null, protocolVersion: null, sessionFingerprint: null };
      assert.equal(prelaunch.channel, 'none');
      assert.equal(prelaunch.sessionFingerprint, null);
      const handshaken = {
        ...prelaunch,
        ...buildWechatIdeRuntime({
          controllerIdentity: 'wechatide-skill@0.3.11#hash',
          protocolVersion: 'wechatide-skill-0.3.10/sdk-test',
          sessionFingerprint: 'a'.repeat(64),
        }),
      };
      assert.equal(handshaken.channel, 'wechatide-mcp');
      assert.equal(handshaken.servicePort, null);
      assert.equal(handshaken.protocolVersion, 'wechatide-skill-0.3.10/sdk-test');
      assert.equal(handshaken.sessionFingerprint, 'a'.repeat(64));
      const common = { candidate: {}, requestId: 'request-123', scenarioId: 'pilot-layout-current-profile' };
      const unknown = buildLayoutCapability({
        ...common,
        observedProfile: { viewportWidth: 375, viewportHeight: 812, fontScalePercent: null, safeAreaBottomPx: null },
        completedChecks: ['page-size'],
      });
      assert.equal(unknown.overallStatus, 'BLOCKED');
    assert.equal(unknown.matrix.filter((row) => row.status === 'BLOCKED').length, 24);
      assert.equal(layoutProfileBlocker(unknown)?.reasonClass, 'identity');
      assert.deepEqual(unknown.automatedCurrentProfileChecks, ['page-size']);
      const exact = buildLayoutCapability({
        ...common,
        observedProfile: { viewportWidth: 375, viewportHeight: 812, fontScalePercent: 150, safeAreaBottomPx: 34 },
        completedChecks: ['page-size', 'not-authorized'],
      });
      // The capability-only vocabulary is OBSERVED/BLOCKED. One identity-bound profile may be
      // OBSERVED, but a single observed tuple is never promoted to PASS, so no row is evidence.
      assert.equal(exact.overallStatus, 'OBSERVED');
      assert.equal(layoutProfileBlocker(exact), null);
      assert.equal(exact.matrix.filter((row) => row.status === 'OBSERVED').length, 1);
      assert.equal(exact.matrix.filter((row) => row.status === 'BLOCKED').length, 23);
      assert.equal(exact.matrix.some((row) => row.status === 'PASS'), false);
      assert.deepEqual(exact.automatedCurrentProfileChecks, ['page-size']);
      const untrusted = buildLayoutCapability({
        ...common,
        observedProfile: { viewportWidth: 375, viewportHeight: 812, fontScalePercent: 150, safeAreaBottomPx: 20 },
        completedChecks: [],
      });
      assert.equal(untrusted.overallStatus, 'BLOCKED');
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const runner = read('.wechat-test/runner/run-readonly-test.mjs');
    expect(runner.indexOf('await miniProgram.open()')).toBeLessThan(runner.indexOf("miniProgram.callWxMethod('getAccountInfoSync')"));
    expect(runner.indexOf('buildWechatIdeRuntime({')).toBeGreaterThan(runner.indexOf("miniProgram.callWxMethod('getAccountInfoSync')"));
  });

  test('binds the wechatide handshake fingerprint to the evidence session nonce', () => {
    const moduleUrl = pathToFileURL(join(root, '.wechat-test/runner/runtime-contract.mjs')).href;
    const probe = `
      import assert from 'node:assert/strict';
      import { buildSessionFingerprint } from ${JSON.stringify(moduleUrl)};
      const common = {
        runId: 'run-1',
        scenarioId: 'home-load',
        startedAt: '2026-09-02T00:00:00.000Z',
        sessionIdentity: {
          endpoint: 'ws://127.0.0.1:43210',
          toolInfoHash: 'tool-hash',
          sourceHash: 'source-hash',
          configHash: 'config-hash',
        },
      };
      const first = buildSessionFingerprint({ ...common, evidenceId: 'evidence-1' });
      const repeated = buildSessionFingerprint({ ...common, evidenceId: 'evidence-1' });
      const second = buildSessionFingerprint({ ...common, evidenceId: 'evidence-2' });
      assert.match(first, /^[a-f0-9]{64}$/u);
      assert.equal(repeated, first);
      assert.notEqual(second, first);
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const runner = read('.wechat-test/runner/run-readonly-test.mjs');
    const fingerprintCalls = runner.match(/sessionFingerprint: buildSessionFingerprint\(\{[\s\S]*?sessionIdentity: \{[\s\S]*?\n\s+\},\n\s+\}\),/gu) ?? [];
    expect(fingerprintCalls).toHaveLength(1);
    fingerprintCalls.forEach((call) => {
      expect(call).toContain('evidenceId: base.evidenceId');
      expect(call).toContain('runId: request.run.runId');
      expect(call).toContain('scenarioId: scenario.id');
      expect(call).toContain('startedAt,');
    });
  });

  test('rejects permission, session and assertion drift without widening the runner', () => {
    const moduleUrl = pathToFileURL(join(root, '.wechat-test/runner/runtime-contract.mjs')).href;
    const scenarioPath = join(root, '.wechat-test/scenarios/home-load.json');
    const ledgerScenarioPath = join(root, '.wechat-test/scenarios/powder-ledger-read-controls.json');
    const probe = `
      import assert from 'node:assert/strict';
      import { readFile } from 'node:fs/promises';
      import { assertScenarioSafety } from ${JSON.stringify(moduleUrl)};
      const scenario = JSON.parse(await readFile(${JSON.stringify(scenarioPath)}, 'utf8'));
      const ledgerScenario = JSON.parse(await readFile(${JSON.stringify(ledgerScenarioPath)}, 'utf8'));
      assert.doesNotThrow(() => assertScenarioSafety(scenario));
      assert.doesNotThrow(() => assertScenarioSafety(ledgerScenario));
      const mutate = (callback) => { const copy = structuredClone(scenario); callback(copy); return copy; };
      const mutateLedger = (callback) => { const copy = structuredClone(ledgerScenario); callback(copy); return copy; };
      assert.throws(() => assertScenarioSafety(mutate((copy) => { copy.permissions.networkAccess = false; })), /must be true|must be false/);
      assert.throws(() => assertScenarioSafety(mutate((copy) => { copy.permissions.testDataMutation = true; })), /must not mutate test data in the local-api channel/);
      assert.throws(() => assertScenarioSafety(mutateLedger((copy) => { copy.permissions.testDataMutation = true; })), /must not mutate test data in the local-api channel/);
      // Replaying the retired mock-session preparation step is an unauthorized action, not a supported
      // write, and announcing a write idempotency strategy in a read-only channel is the same drift.
      assert.throws(() => assertScenarioSafety(mutateLedger((copy) => { copy.steps[0] = { ...copy.steps[0], action: 'prepare-mock-session', mutationClass: 'test-data', idempotencyStrategy: 'single-attempt-exact-restore' }; })), /unauthorized action or mutation/);
      assert.throws(() => assertScenarioSafety(mutateLedger((copy) => { copy.steps[0].idempotencyStrategy = 'single-attempt-exact-restore'; })), /unauthorized action or mutation/);
      assert.throws(() => assertScenarioSafety(mutateLedger((copy) => { copy.writePolicy = { maxAttempts: 2 }; })), /write policy must remain null/);
      // home-load now signs in first, so the drifting direction is a scenario that drops the session.
      assert.throws(() => assertScenarioSafety(mutate((copy) => { copy.session.mode = 'none'; })), /session contract drifted/);
      assert.throws(() => assertScenarioSafety(mutate((copy) => { copy.assertions = []; })), /assertions must remain/);
      assert.throws(() => assertScenarioSafety(mutate((copy) => { copy.assertions[0].severity = 'OPTIONAL'; })), /assertions must remain/);
      assert.throws(() => assertScenarioSafety(mutate((copy) => { copy.assertions[0].expected = false; })), /assertion contract drifted/);
      assert.throws(() => assertScenarioSafety(mutate((copy) => { copy.assertions[0].target.value = '.substituted'; })), /assertion contract drifted/);
      assert.throws(() => assertScenarioSafety(mutate((copy) => { copy.steps[0].wait.condition = 'none'; })), /wait contract drifted/);
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  test('enforces the tighter declared wall-clock budget so a stalled runtime still yields a verdict', () => {
    const moduleUrl = pathToFileURL(join(root, '.wechat-test/runner/run-readonly-test.mjs')).href;
    const probe = `
      import assert from 'node:assert/strict';
      import { resolveScenarioBudgetMs } from ${JSON.stringify(moduleUrl)};
      assert.equal(resolveScenarioBudgetMs({ execution: { totalBudgetSeconds: 1200 } }, { timeBudgetSeconds: 300 }), 300000);
      assert.equal(resolveScenarioBudgetMs({ execution: { totalBudgetSeconds: 120 } }, { timeBudgetSeconds: 300 }), 120000);
      assert.throws(() => resolveScenarioBudgetMs({ execution: {} }, {}), /must declare a positive wall-clock budget/);
      assert.throws(() => resolveScenarioBudgetMs({ execution: { totalBudgetSeconds: 0 } }, { timeBudgetSeconds: -1 }), /must declare a positive wall-clock budget/);
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const runner = read('.wechat-test/runner/run-readonly-test.mjs');
    // A scenario that stalls must end with blocked evidence instead of leaving the round hanging.
    expect(runner).toContain('const budgetTimer = setTimeout(');
    expect(runner).toContain('clearTimeout(budgetTimer)');
    expect(runner).toContain('miniProgram?.cancel()');
    expect(runner).not.toContain('process.exit(1)');
    expect(runner).toContain("'timeout', 'Scenario exceeded its work or cleanup deadline.'");
    // The reviewed Skill only accepts its own blocker vocabulary, and a receipt becomes unbuildable
    // when evidence carries anything else, so the runner has to normalise the class explicitly.
    expect(runner).toContain('const REVIEWED_REASON_CLASSES = new Set([');
    expect(runner).toContain('function normalizeReasonClass(reasonClass) {');
    expect(runner).toContain("blockers: [{ reasonClass: normalizeReasonClass(reasonClass), detail, nextStep }]");
  });
});
