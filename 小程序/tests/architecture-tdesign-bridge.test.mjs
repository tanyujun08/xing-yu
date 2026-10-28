import { expect, test } from 'vitest';
import fs from 'node:fs';
import { URL } from 'node:url';
import { evaluateFixtureRule } from '../scripts/check-miniprogram-architecture.mjs';

const page = 'miniprogram/pages/confirm/index.wxss';
const authority = fs.readFileSync(new URL('../miniprogram/app.wxss', import.meta.url), 'utf8');
function scan(style, path = page, tokens = authority) {
  return evaluateFixtureRule('MPA-TOKEN-001', new Map([
    [path, style], ['miniprogram/app.wxss', tokens],
    [path.replace(/\.wxss$/, '.wxml'), '<page-meta root-font-size="system" />'],
  ]), {});
}
const valid = '.checkout-step { --td-step-item-process-circle-bg:var(--xy-color-brand); }';

test('official checkout Steps adapter accepts all fifteen existing token mappings', () => {
  const source = fs.readFileSync(new URL('../miniprogram/pages/confirm/index.wxss', import.meta.url), 'utf8');
  const bridge = source.match(/\.checkout-step\s*\{[^}]*\}/)?.[0];
  expect(bridge).toBeTruthy();
  expect((bridge.match(/--td-[\w-]+\s*:/g) ?? []).length).toBe(15);
  expect(scan(bridge)).toEqual([]);
});

test.each(['miniprogram/pages/info/index.wxss', 'miniprogram/components/probe/index.wxss'])(
  'rejects the same mapping outside the approved page: %s', (path) => {
    expect(scan(valid, path).some((item) => item.ruleId === 'MPA-TOKEN-001')).toBe(true);
  },
);

test.each([
  '.other { --td-step-item-process-circle-bg:var(--xy-color-brand); }',
  '.checkout-step, .other { --td-step-item-process-circle-bg:var(--xy-color-brand); }',
  '.checkout-step { --td-unapproved:var(--xy-color-brand); }',
  '.checkout-step { --td-step-item-process-circle-bg:#00aa66; }',
  '.checkout-step { --td-step-item-circle-size:24px; }',
  '.checkout-step { --td-step-item-circle-size:calc(var(--xy-space-3) + 12px); }',
  '.checkout-step { --td-step-item-process-circle-bg:var(--xy-color-brand, red); }',
  '.checkout-step { --td-step-item-process-circle-bg:var(--xy-new-meaning); }',
  '.checkout-step { --td-step-item-process-circle-bg:var(--td-brand-color); }',
])('rejects unauthorized selectors, names and values: %s', (style) => {
  expect(scan(style).some((item) => item.ruleId === 'MPA-TOKEN-001')).toBe(true);
});

test('does not fabricate token authority when app tokens are missing', () => {
  expect(scan(valid, page, '').some((item) => item.ruleId === 'MPA-TOKEN-001')).toBe(true);
});
