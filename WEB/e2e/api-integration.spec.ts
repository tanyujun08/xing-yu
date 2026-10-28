import { systemInteractions } from './system-interactions';
import { test, expect, type Page } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { components } from '../src/shared/api/generated/schema';

const origin = process.env.XINGYU_PACKAGED_ORIGIN ?? '';
const project = process.env.XINGYU_PACKAGED_PROJECT ?? '';
const worker = process.env.XINGYU_PACKAGED_WORKER ?? '';
const dockerContext = process.env.XINGYU_PACKAGED_DOCKER_CONTEXT ?? '';
const handoffProfile = process.env.XINGYU_PACKAGED_HANDOFF_PROFILE ?? '';
const handoffWorkerImage = process.env.XINGYU_PACKAGED_HANDOFF_WORKER_IMAGE ?? '';
const handoffSourceHash = process.env.XINGYU_PACKAGED_HANDOFF_SOURCE_HASH ?? '';

// An explicit privacy boundary: Playwright causes may contain authentication
// DOM/response material. Only this finite stage category may reach its reporter.
function redactedStageError(error: unknown, stage: string): Error {
  if (error instanceof Error && /^W6_STAGE_[A-Z_]+(?:_\d{3})?$/.test(error.message)) return new Error(error.message);
  return new Error('W6_STAGE_' + stage);
}

function proofFromExclusiveWorker(phone: string): string | null {
  const handoff = project === 'xingyu-dev';
  const boundProfile = handoff && origin === 'http://127.0.0.1:5155'
    && ['v1.0.0.14-idn-20260904-e9b08607434242848a70961a8b6d7c9a', 'admin-system-e1854381bccd42b6a3079b7780dcbad9'].includes(handoffProfile)
    && /^sha256:[a-f0-9]{64}$/.test(handoffWorkerImage) && /^[a-f0-9]{64}$/.test(handoffSourceHash);
  const boundS3 = /^xingyu-s3-xy-\d{8}-[a-f0-9]{32}-[a-f0-9]{12}$/.test(project)
    && !handoffProfile && !handoffWorkerImage && !handoffSourceHash;
  if ((!boundProfile && !boundS3) || !/^[a-f0-9]{64}$/.test(worker) || !dockerContext) throw new Error('Unbound test worker');
  const args = ['--context', dockerContext];
  try {
    const actual = execFileSync('docker', [...args, 'inspect', '--format', '{{ index .Config.Labels "com.docker.compose.project" }}', worker], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    if (actual !== project) throw new Error('Wrong worker');
    if (handoff) {
      // Read only the non-secret identity fields; an arbitrary xingyu-dev
      // worker must never expose its private proof observer to this test.
      const identity = execFileSync('docker', [...args, 'inspect', '--format', '{{ .Image }}|{{ index .Config.Labels "io.xingyu.handoff-profile" }}|{{ index .Config.Labels "io.xingyu.source-hash" }}|{{ index .Config.Labels "com.docker.compose.service" }}', worker], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      if (identity !== [handoffWorkerImage, handoffProfile, handoffSourceHash, 'worker'].join('|')) throw new Error('Wrong handoff worker identity');
    }
    const digest = createHash('sha256').update('+86' + phone).digest('hex');
    const proof = execFileSync('docker', [...args, 'exec', worker, 'curl', '--fail', '--silent', '--max-time', '2', '--unix-socket', '/tmp/xingyu-debug-proof.sock', 'http://localhost/' + digest], { encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return /^\d{6}$/.test(proof) ? proof : null;
  } catch { return null; } // Never attach subprocess output or a proof to failure text.
}

async function login(page: Page, phone: string) {
  let stage = 'AUTH_FORM';
  try {
  await page.goto(origin + '/login');
  await expect(page.getByRole('form', { name: 'API 手机号登录' })).toBeVisible();
  stage = 'AUTH_PHONE_FIELD';
  await page.getByLabel('手机号', { exact: true }).fill(phone);
  stage = 'AUTH_CHALLENGE';
  const challenge = page.waitForResponse((r) => new URL(r.url()).pathname === '/v1/ops/auth/phone/challenges' && r.request().method() === 'POST');
  await page.getByRole('button', { name: '获取验证码', exact: true }).click();
  const challengeStatus = (await challenge).status();
  if (challengeStatus !== 201) throw new Error('W6_STAGE_AUTH_CHALLENGE_' + challengeStatus);
  stage = 'AUTH_DELIVERY_PROOF';
  let proof: string | null = null;
  for (let attempt = 0; attempt < 30 && proof === null; attempt += 1) {
    proof = proofFromExclusiveWorker(phone);
    if (proof === null) await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (proof === null) throw new Error('Actual generated Fake delivery proof unavailable');
  stage = 'AUTH_SESSION';
  try {
    await page.getByLabel('验证码', { exact: true }).fill(proof);
    const session = page.waitForResponse((r) => new URL(r.url()).pathname === '/v1/ops/auth/phone/sessions' && r.request().method() === 'POST');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    if ((await session).status() !== 201) throw new Error('Normal phone authentication rejected');
    await expect(page.getByRole('button', { name: /^账户菜单：/ })).toBeVisible();
  } catch { throw new Error('W6_STAGE_' + stage); }
  finally {
    const field = page.getByLabel('验证码', { exact: true });
    if (await field.count() > 0) await field.fill('').catch(() => undefined);
  }
  } catch (error) {
    throw redactedStageError(error, stage);
  }
}

// This helper is exclusively for the isolated S3 Fake provider. It cannot
// approve a real WeChat challenge or inspect the persistent development profile.
async function approveSyntheticWechat(page: Page, purpose: 'BIND' | 'LOGIN', existingToken?: string) {
  const localHandoff = project === 'xingyu-dev' && origin === 'http://127.0.0.1:5155' && handoffProfile === 'admin-system-e1854381bccd42b6a3079b7780dcbad9'
    && /^sha256:[a-f0-9]{64}$/.test(handoffWorkerImage) && /^[a-f0-9]{64}$/.test(handoffSourceHash);
  const isolated = /^xingyu-s3-xy-\d{8}-[a-f0-9]{32}-[a-f0-9]{12}$/.test(project) && !handoffProfile;
  if ((!localHandoff && !isolated) || !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('W6_STAGE_WECHAT_BOUNDARY');
  const image = page.getByRole('img', { name: purpose === 'BIND' ? '后台账号微信绑定码' : '后台扫码登录码', exact: true });
  await expect(image).toBeVisible();
  const uri = await image.getAttribute('src');
  if (!uri?.startsWith('data:image/svg+xml;base64,')) throw new Error('W6_STAGE_WECHAT_FAKE_IMAGE');
  const svg = Buffer.from(uri.slice('data:image/svg+xml;base64,'.length), 'base64').toString('utf8');
  const scene = /<text x="30" y="230">([A-Za-z0-9_-]{24,32})<\/text>/.exec(svg)?.[1];
  if (!scene || !svg.includes('LOCAL TEST - NOT A WECHAT CODE')) throw new Error('W6_STAGE_WECHAT_FAKE_SCENE');
  let token = existingToken;
  if (!token) {
    const session = await page.request.post(origin + '/v1/auth/wechat-mini/sessions', {
      headers: { 'Idempotency-Key': randomUUID() }, data: { code: 's3-mini:admin-browser-binding' }, maxRedirects: 0,
    });
    if (session.status() !== 201) throw new Error('W6_STAGE_WECHAT_MINI_SESSION_' + session.status());
    const body = await session.json() as { access_token?: string };
    token = body.access_token;
    if (!token) throw new Error('W6_STAGE_WECHAT_MINI_TOKEN');
  }
  const headers = { Authorization: 'Bearer ' + token };
  const inspected = await page.request.post(origin + '/v1/me/ops-wechat-challenges/inspect', {
    headers, data: { scan_token: scene }, maxRedirects: 0,
  });
  if (inspected.status() !== 200) throw new Error('W6_STAGE_WECHAT_INSPECT_' + inspected.status());
  const preview = await inspected.json() as { purpose?: string; status?: string };
  if (preview.purpose !== purpose || preview.status !== 'PENDING') throw new Error('W6_STAGE_WECHAT_PURPOSE');
  // Inspect alone must leave the browser waiting for an explicit decision.
  await expect(page.getByText('等待小程序确认', { exact: true })).toBeVisible();
  const decided = await page.request.post(origin + '/v1/me/ops-wechat-challenges/decisions', {
    headers: { ...headers, 'Idempotency-Key': randomUUID() }, data: { scan_token: scene, approve: true }, maxRedirects: 0,
  });
  if (decided.status() !== 200) throw new Error('W6_STAGE_WECHAT_DECISION_' + decided.status());
  await expect(image).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^账户菜单：/ })).toBeVisible();
  return token;
}
test('packaged API mode preserves anonymous authentication and network policy', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const response = await context.request.get(origin + '/v1/ops/auth/me');
    expect(response.status()).toBe(401);
    const html = await context.request.get(origin + '/login');
    expect(html.status()).toBe(200);
    expect(html.headers()['content-security-policy']).toContain("connect-src 'self' ");
    expect(html.headers()['content-security-policy']).not.toContain('connect-src *');
    expect((await context.request.get(origin + '/__s3_objects/read')).status()).toBe(403);
  } finally { await context.close(); }
});

test('normal phone login reads real system pages and uploads through shared Fake storage', async ({ browser }) => {
  test.setTimeout(360_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  let stage = 'LOGIN';
  try {
    await login(page, '10000000001');
    stage = 'WECHAT_BIND';
    const miniToken = await approveSyntheticWechat(page, 'BIND');
    for (const [path, endpoint] of [
      ['/settings/rules', '/v1/ops/system-config/definitions'],
      ['/settings/loyalty', '/v1/ops/system-config/effective'],
      ['/settings/roles', '/v1/ops/iam/roles'],
      ['/settings/admins', '/v1/ops/iam/accounts'],
      ['/settings/login-logs', '/v1/ops/iam/login-events'],
      ['/settings/operation-logs', '/v1/ops/iam/operation-events'],
    ]) {
      stage = 'PAGE_' + path.split('/').at(-1)!.toUpperCase().replaceAll('-', '_');
      // Keep only a status/category on failure, never an auth response or DOM.
      let refreshStatus = 0;
      let clientError = false;
      const observeRefresh = (response: import('@playwright/test').Response) => {
        if (new URL(response.url()).pathname === '/v1/ops/auth/refresh') refreshStatus = response.status();
      };
      const observeError = () => { clientError = true; };
      page.on('response', observeRefresh);
      page.on('pageerror', observeError);
      const loaded = page.waitForResponse((r) => new URL(r.url()).pathname === endpoint && r.request().method() === 'GET', { timeout: 15_000 }).catch(() => null);
      await page.goto(origin + path);
      const response = await loaded;
      page.off('response', observeRefresh);
      page.off('pageerror', observeError);
      if (response === null) throw new Error('W6_STAGE_' + stage + (clientError ? '_CLIENT_ERROR' : refreshStatus ? '_REFRESH_' + refreshStatus : '_NO_RESPONSE'));
      if (response.status() !== 200) throw new Error('W6_STAGE_' + stage + '_' + response.status());
      await expect(page.getByRole('button', { name: /^账户菜单：/ })).toBeVisible();
    }
    await page.goto(origin + '/catalog');
    await page.getByRole('button', { name: '新增标准商品', exact: true }).click();
    const materialForm = page.locator('.admin-form-drawer');
    await expect(materialForm.getByRole('heading', { name: '新增标准商品', exact: true })).toBeVisible();
    // A browser-encoded synthetic image, with no source media or personal data.
    stage = 'SYNTHETIC_IMAGE';
    const base64 = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 2; canvas.height = 2;
      const ctx = canvas.getContext('2d');
      if (ctx === null) throw new Error('Synthetic fixture unavailable');
      ctx.fillStyle = '#147d64'; ctx.fillRect(0, 0, 2, 2);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    let leaked = false;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/__s3_objects/') && (request.headers().authorization || request.headers().cookie)) leaked = true;
    });
    type Material = components['schemas']['Material'];
    type MaterialFileResult = components['schemas']['MaterialFileResult'];
    const materialReads: Promise<Material>[] = [];
    const observeMaterialRead = (response: import('@playwright/test').Response) => {
      if (response.request().method() === 'GET' && /^\/v1\/materials\/[^/]+$/.test(new URL(response.url()).pathname) && response.status() === 200) materialReads.push(response.json() as Promise<Material>);
    };
    page.on('response', observeMaterialRead);
    const upload = page.waitForResponse((r) => new URL(r.url()).pathname === '/v1/materials/files' && r.request().method() === 'POST');
    stage = 'MATERIAL_UPLOAD';
    await materialForm.getByLabel('上传商品图片文件选择', { exact: true }).setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') });
    const response = await upload;
    if (![201, 202].includes(response.status())) throw new Error('W6_STAGE_MATERIAL_UPLOAD_' + response.status());
    const uploaded = await response.json() as MaterialFileResult;
    expect(uploaded.material_id).toBeTruthy();
    stage = 'MATERIAL_READY';
    const thumbnail = materialForm.getByRole('img', { name: '上传商品图片 1', exact: true });
    await expect(thumbnail).toBeVisible({ timeout: 120_000 });
    page.off('response', observeMaterialRead);
    const reads = await Promise.all(materialReads);
    const ready = uploaded.status === 'READY' ? uploaded : reads.find((item) => item.material_id === uploaded.material_id && item.status === 'READY');
    expect(ready?.material_id).toBe(uploaded.material_id); expect(ready?.public_url).toMatch(/^https:\/\//);
    await expect(thumbnail).toHaveAttribute('src', ready!.public_url!);
    await expect(materialForm.getByRole('button', { name: '确认已上传对象', exact: true })).toHaveCount(0);
    stage = 'MATERIAL_PREVIEW';
    await materialForm.getByRole('button', { name: '查看上传商品图片 1大图', exact: true }).click();
    await expect(page.getByRole('img', { name: '上传商品图片 1大图', exact: true })).toHaveAttribute('src', ready!.public_url!);
    await page.getByRole('button', { name: '关闭', exact: true }).last().click();
    expect(leaked).toBe(false);
    stage = 'SYSTEM_INTERACTIONS';
    await systemInteractions(page, origin);
    stage = 'LOGOUT';
    await page.getByRole('button', { name: /^账户菜单：/ }).click();
    const logout = page.waitForResponse((r) => new URL(r.url()).pathname === '/v1/ops/auth/logout' && r.request().method() === 'POST');
    await page.getByText('退出后台', { exact: true }).click();
    expect((await logout).status()).toBe(204);
    await expect(page.getByRole('form', { name: 'API 手机号登录' })).toBeVisible();
    stage = 'WECHAT_LOGIN';
    await page.getByRole('tab', { name: '微信扫码登录', exact: true }).click();
    await approveSyntheticWechat(page, 'LOGIN', miniToken);
  } catch (error) {
    throw redactedStageError(error, stage);
  }
  finally { await context.close(); } // Close before Playwright can capture failure-page state.
});
