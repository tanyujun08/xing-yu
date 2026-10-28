import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { readPolicy, evaluateFixtureRule } from '../scripts/check-miniprogram-architecture.mjs';

const policyPath = 'config/miniprogram-architecture-policy.json';
const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
const packageSource = readFileSync('package.json', 'utf8');
const appSource = readFileSync('miniprogram/app.json', 'utf8');
const validate = (value) => readPolicy(new Map([[policyPath, JSON.stringify(value)]]));
const coverage = (value) => evaluateFixtureRule('MPA-AUTH-001', new Map([['package.json', packageSource], ['miniprogram/app.json', appSource]]), value);

test('current new pages use the complete strict rules and exact route partition', () => {
  expect(() => validate(policy)).not.toThrow();
  expect(coverage(policy)).toEqual([]);
  const files = new Map([
    ['miniprogram/pages/coupons/index.wxml', '<page-meta root-font-size="system" /><button bindtap="save">保存</button>'],
    ['miniprogram/pages/coupons/index.ts', 'Page({ save() { mockApi.command.saveAddress({}); } });'],
  ]);
  expect(evaluateFixtureRule('MPA-ASYNC-001', files, policy).some((item) => item.message.includes('single-flight'))).toBe(true);
});
test('new page cannot claim legacy exemption or change the immutable baseline set', () => {
  const masquerade = JSON.parse(JSON.stringify(policy));
  masquerade.visualOnlyMigrationWxmlPaths.push(masquerade.newlyGovernedWxmlPaths.pop());
  masquerade.visualOnlyMigrationWxmlPaths.sort();
  expect(() => validate(masquerade)).toThrow(/New pages/);
  const historical = JSON.parse(JSON.stringify(policy));
  historical.legacyBaselineGovernedWxmlPaths.push('miniprogram/pages/coupons/index.wxml');
  expect(() => validate(historical)).toThrow(/exact normalized replay/);
});
test.each(['missing', 'duplicate', 'ghost'])('route coverage rejects %s membership', (kind) => {
  const damaged = JSON.parse(JSON.stringify(policy));
  if (kind === 'missing') damaged.newlyGovernedWxmlPaths.pop();
  if (kind === 'duplicate') damaged.newlyGovernedWxmlPaths.push(damaged.legacyBaselineGovernedWxmlPaths[0]);
  if (kind === 'ghost') damaged.newlyGovernedWxmlPaths.push('miniprogram/pages/removed/index.wxml');
  expect(coverage(damaged).some((item) => item.ruleId === 'MPA-AUTH-001')).toBe(true);
});

test('approved API page may reach the request adapter but must never reach Mock', () => {
  const sources = new Map([['package.json', packageSource], ['miniprogram/app.json', appSource],
    ['miniprogram/pages/login/index.ts', "import { api } from '../../shared/api/account-api'; Page({ onLoad(){ api(); } });"],
    ['miniprogram/shared/api/account-api.ts', "import { request } from './request'; export const api = request;"],
    ['miniprogram/shared/api/request.ts', 'export const request = () => wx.request({});']]);
  expect(evaluateFixtureRule('MPA-AUTH-001', sources, policy)).toEqual([]);
  sources.set('miniprogram/shared/api/account-api.ts', "import { mockApi } from './mock-api'; export const api = mockApi;");
  sources.set('miniprogram/shared/api/mock-api.ts', 'export const mockApi = {};');
  expect(evaluateFixtureRule('MPA-AUTH-001', sources, policy).some((item) => item.message.includes('API must not reach Mock'))).toBe(true);
});
test.each([['*'], ['miniprogram/pages/login/index.ts', 'miniprogram/pages/login/index.ts']])('API route declaration rejects broad or duplicate paths %j', (paths) => {
  expect(() => validate({ ...policy, apiConnectedPages: paths })).toThrow();
});