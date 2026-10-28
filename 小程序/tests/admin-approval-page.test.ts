import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ApiProblem } from '../miniprogram/shared/api/problem';
const api = vi.hoisted(() => ({ owner: 'mini-a' as string | null, inspect: vi.fn(), decide: vi.fn(), sequence: 0 }));
vi.mock('../miniprogram/shared/api/account-api', async () => ({ accountApi: { sessionIdentity: () => api.owner, inspectOpsChallenge: api.inspect, decideOpsChallenge: api.decide, newIntent: () => `intent-${++api.sequence}` }, ApiProblem: (await import('../miniprogram/shared/api/problem')).ApiProblem }));
interface Harness { data: { status: string; error: string; uncertain: boolean; loggedIn: boolean; [key: string]: unknown }; setData(p: Record<string, unknown>): void; [key: string]: unknown }
let definition: Harness; let page: Harness;
const scene = 'a'.repeat(24);
beforeAll(async () => { vi.stubGlobal('Page', (value: Harness) => { definition = value; }); await import('../miniprogram/pages/admin-approval/index'); });
beforeEach(() => { api.owner='mini-a'; api.sequence=0; api.inspect.mockReset(); api.decide.mockReset(); api.inspect.mockReturnValue({promise:Promise.resolve({purpose:'BIND',status:'PENDING',display_name:'管理员',phone_masked:'138****0000'})}); api.decide.mockReturnValue({promise:Promise.resolve({status:'CONSUMED'})}); vi.stubGlobal('wx',{navigateBack:vi.fn(),switchTab:vi.fn()}); page={...definition,data:structuredClone(definition.data),setData(p){Object.assign(this.data,p);}}; call('onLoad',{scene}); });
afterEach(()=>call('onUnload')); afterAll(()=>vi.unstubAllGlobals());
function call(name:string,...args:unknown[]){return(page[name] as (...args:unknown[])=>unknown).apply(page,args);}

const markup = readFileSync(new URL('../miniprogram/pages/admin-approval/index.wxml', import.meta.url), 'utf8');
function templateCondition(marker: string): boolean {
  const tag = [...markup.matchAll(/<[^>]+>/g)].map(match => match[0]).find(value => value.includes(marker));
  const attribute = tag?.match(/wx:(?:if|elif)="([^"]+)"/)?.[1];
  expect(attribute, `missing template condition for ${marker}`).toBeDefined();
  // A bare WXML attribute is a nonempty string, not an evaluated expression.
  if (!attribute?.startsWith('{{') || !attribute.endsWith('}}')) return Boolean(attribute);
  return Boolean(runInNewContext(attribute.slice(2, -2), { ...page.data }, { timeout: 100 }));
}

test('all approval template conditions bind dynamic WXML expressions', () => {
  const conditions = [...markup.matchAll(/wx:(?:if|elif)="([^"]+)"/g)];
  expect(conditions.length).toBeGreaterThan(0);
  for (const condition of conditions) {
    expect(condition[1]).toMatch(/^\{\{[\s\S]+\}\}$/);
    expect(condition[1]).not.toMatch(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/i);
    expect(() => runInNewContext(condition[1]!.slice(2, -2), { ...page.data }, { timeout: 100 })).not.toThrow();
  }
});

test('template follows actual inspection state instead of permanent loading and login controls', async () => {
  api.owner = null;
  await call('inspect');
  expect(templateCondition('bindtap="login"')).toBe(true);
  expect(templateCondition('wx:if="{{busy}}"')).toBe(false);
  api.owner = 'mini-a';
  let resolve!: (value: unknown) => void;
  api.inspect.mockReturnValueOnce({ promise: new Promise(result => { resolve = result; }) });
  const pending = call('inspect');
  expect(templateCondition('wx:if="{{busy}}"')).toBe(true);
  expect(templateCondition('bindtap="login"')).toBe(false);
  resolve({ purpose: 'BIND', status: 'PENDING', display_name: '管理员' });
  await pending;
  expect(templateCondition('wx:if="{{busy}}"')).toBe(false);
  expect(templateCondition('bindtap="login"')).toBe(false);
  expect(templateCondition("status === 'PENDING'")).toBe(true);
  expect(templateCondition('role="alert"')).toBe(false);
  expect(templateCondition('bindtap="retryDecision"')).toBe(false);
  expect(templateCondition('bindtap="inspect"')).toBe(false);
  await call('decide', true);
  expect(templateCondition("status === 'PENDING'")).toBe(false);
  expect(templateCondition("status === 'CONSUMED'")).toBe(true);
});

test('template distinguishes uncertain decisions, query errors and terminal states', () => {
  page.setData({ loggedIn: true, error: '查询失败', uncertain: false });
  expect(templateCondition('role="alert"')).toBe(true);
  expect(templateCondition('bindtap="inspect"')).toBe(true);
  page.setData({ uncertain: true });
  expect(templateCondition('bindtap="retryDecision"')).toBe(true);
  expect(templateCondition('bindtap="inspect"')).toBe(false);
  for (const status of ['PENDING', 'CONSUMED', 'APPROVED', 'REJECTED', 'EXPIRED']) {
    page.setData({ status });
    expect(templateCondition("status === 'CONSUMED'")).toBe(['CONSUMED', 'APPROVED'].includes(status));
    expect(templateCondition("status === 'REJECTED'")).toBe(status === 'REJECTED');
    expect(templateCondition("status === 'EXPIRED'")).toBe(status === 'EXPIRED');
  }
});
test('does not inspect invalid scene or unauthenticated Mini identity',async()=>{call('onLoad',{scene:'phone=13800000000'});await call('inspect');expect(api.inspect).not.toHaveBeenCalled();expect(page.data.error).toContain('二维码无效');call('onLoad',{scene});api.owner=null;await call('inspect');expect(api.inspect).not.toHaveBeenCalled();expect(page.data.loggedIn).toBe(false);});
test('inspection never approves implicitly and rejection sends an explicit false decision',async()=>{await call('inspect');expect(api.decide).not.toHaveBeenCalled();expect(page.data.status).toBe('PENDING');await call('decide',false);expect(api.decide).toHaveBeenCalledWith(scene,false,'intent-1');expect(page.data.status).toBe('CONSUMED');});
test('unknown result retains original intent and prevents an opposite decision',async()=>{await call('inspect');api.decide.mockReturnValueOnce({promise:Promise.reject(new Error('timeout'))});await call('decide',true);expect(page.data.uncertain).toBe(true);await call('decide',false);expect(api.decide).toHaveBeenCalledTimes(1);await call('decide',true);expect(api.decide.mock.calls[1]).toEqual(api.decide.mock.calls[0]);expect(page.data.status).toBe('CONSUMED');});
test('a changed Mini account cannot confirm an earlier account inspection',async()=>{await call('inspect');api.owner='mini-b';await call('decide',true);expect(api.decide).not.toHaveBeenCalled();expect(page.data.error).toContain('登录身份已变化');});
test('a late inspection after hiding cannot update the page',async()=>{let resolve!:(v:unknown)=>void;api.inspect.mockReturnValueOnce({promise:new Promise(r=>{resolve=r;})});const pending=call('inspect');call('onHide');resolve({purpose:'BIND',status:'PENDING',display_name:'late'});await pending;expect(page.data.status).toBe('');});

test('unbound WeChat receives binding guidance without implicitly approving or binding', async () => {
  await call('inspect');
  api.decide.mockReturnValueOnce({ promise: Promise.reject(new ApiProblem(403, { code: 'OPS_WECHAT_NOT_BOUND', message: 'unbound', request_id: 'synthetic' })) });
  await call('decide', true);
  expect(page.data.error).toContain('请先在电脑使用手机号登录管理后台');
  expect(page.data.uncertain).toBe(false);
  expect(page.data.status).toBe('PENDING');
  expect(api.decide).toHaveBeenCalledTimes(1);
  expect(templateCondition('role="alert"')).toBe(true);
});

test('ordinary permission failures are not mislabeled as missing WeChat binding', async () => {
  await call('inspect');
  api.decide.mockReturnValueOnce({ promise: Promise.reject(new ApiProblem(403, { code: 'PERMISSION_DENIED', message: 'denied', request_id: 'synthetic' })) });
  await call('decide', true);
  expect(page.data.error).toBe('确认失败，请重新查询状态或扫描新二维码。');
  expect(page.data.uncertain).toBe(false);
});
