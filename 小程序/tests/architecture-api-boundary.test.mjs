import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { evaluateFixtureRule } from '../scripts/check-miniprogram-architecture.mjs';
const policy = JSON.parse(readFileSync('config/miniprogram-architecture-policy.json', 'utf8'));
function sources(page, facade = 'supply-api') {
  return new Map([
    ['package.json', readFileSync('package.json', 'utf8')], ['miniprogram/app.json', readFileSync('miniprogram/app.json', 'utf8')],
    [`miniprogram/pages/${page}/index.ts`, `import { api } from '../../shared/api/${facade}'; Page({ onShow(){ api(); } });`],
    [`miniprogram/shared/api/${facade}.ts`, "import { request } from './request'; export const api = request;"],
    ['miniprogram/shared/api/request.ts', 'export const request = () => wx.request({});'],
  ]);
}
test.each(['home', 'detail', 'region', 'orders'])('%s uses a named API facade and rejects reachable Mock', page => {
  const files = sources(page);
  expect(evaluateFixtureRule('MPA-DEP-001', files, policy)).toEqual([]);
  expect(evaluateFixtureRule('MPA-AUTH-001', files, policy)).toEqual([]);
  files.set('miniprogram/shared/api/supply-api.ts', "import { mockApi } from './mock-api'; export const api = mockApi;");
  files.set('miniprogram/shared/api/mock-api.ts', 'export const mockApi = {};');
  expect(evaluateFixtureRule('MPA-AUTH-001', files, policy).some(f => f.message.includes('API must not reach Mock'))).toBe(true);
});
test('powder mall is API-connected through the benefit facade and rejects any reachable Mock', () => {
  const pagePath = 'miniprogram/pages/powder-mall/index.ts';
  const files = sources('powder-mall', 'account-api');
  files.set(pagePath, readFileSync(pagePath, 'utf8'));
  expect(policy.apiConnectedPages).toContain(pagePath);
  expect(evaluateFixtureRule('MPA-DEP-001', files, policy)).toEqual([]);
  expect(evaluateFixtureRule('MPA-AUTH-001', files, policy)).toEqual([]);
  const disconnected = { ...policy, apiConnectedPages: policy.apiConnectedPages.filter(path => path !== pagePath) };
  expect(evaluateFixtureRule('MPA-AUTH-001', files, disconnected).some(f => f.message.includes('unconnected page must not reach network'))).toBe(true);
  files.set('miniprogram/shared/api/account-api.ts', "import { request } from './request'; import { mockApi } from './mock-api'; export const accountApi = {}; export const benefitApi = { summary: request, mockApi };");
  files.set('miniprogram/shared/api/mock-api.ts', 'export const mockApi = {};');
  expect(evaluateFixtureRule('MPA-AUTH-001', files, policy).some(f => f.message.includes('API must not reach Mock'))).toBe(true);
});
test('a not-yet-connected page cannot gain network access through an approved facade', () => {
  expect(evaluateFixtureRule('MPA-AUTH-001', sources('withdrawal'), policy).some(f => f.message.includes('unconnected page must not reach network'))).toBe(true);
});
test.each(['../../shared/api/request', '../../shared/session/api-session', '../../shared/api/unknown-api'])('pages cannot import %s directly', dependency => {
  const files = new Map([['miniprogram/pages/home/index.ts', `import { value } from '${dependency}'; Page({data:{value}});`]]);
  expect(evaluateFixtureRule('MPA-DEP-001', files, policy)).toHaveLength(1);
});
test.each(['../api/supply-api', '../../../types/api/schema'])('presentation cannot import %s', dependency => {
  const files = new Map([['miniprogram/shared/presentation/test.ts', `import type { Value } from '${dependency}'; export type Display = Value;`]]);
  expect(evaluateFixtureRule('MPA-DEP-001', files, policy)).toHaveLength(1);
});
