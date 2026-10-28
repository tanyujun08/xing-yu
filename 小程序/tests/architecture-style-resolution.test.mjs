import { expect, test } from 'vitest';
import { evaluateFixtureRule } from '../scripts/check-miniprogram-architecture.mjs';

const component = 'miniprogram/components/probe';
function findings(style, imports = {}, markup = '<view class="rail" bindtap="select" role="button">筛选</view>') {
  return evaluateFixtureRule('MPA-TYPE-001', new Map(Object.entries({
    [`${component}/index.wxss`]: style,
    [`${component}/index.wxml`]: markup,
    ...imports,
  })), {});
}
function touchFindings(...args) { return findings(...args).filter((finding) => finding.semanticSubject.includes('touch-contract:')); }
const railPath = 'miniprogram/shared/design/rail.wxss';
const railImport = '@import "../../shared/design/rail.wxss";';

test('accepts an explicitly imported same-repository 44px rail rule', () => {
  expect(findings(railImport, { [railPath]: '.rail { min-height:44px; }' })).toEqual([]);
});

test('accepts recursive quoted and url imports and local miniprogram-root paths', () => {
  expect(findings(railImport, {
    [railPath]: '@import url("./nested.wxss");',
    'miniprogram/shared/design/nested.wxss': '.rail { min-height: var(--xy-size-touch-min); }',
  })).toEqual([]);
  expect(findings('@import "/shared/design/rail.wxss";', { [railPath]: '.rail { min-height:44px; }' })).toEqual([]);
});

test('does not infer a contract from an unrelated shared file or commented import', () => {
  const shared = { [railPath]: '.rail { min-height:44px; }' };
  expect(touchFindings('', shared)).toHaveLength(1);
  expect(touchFindings(`/* ${railImport} */`, shared)).toHaveLength(1);
  expect(touchFindings(railImport)).toHaveLength(1);
});

test('cycles terminate without fabricating missing height proof', () => {
  const cycle = { [railPath]: '@import "./loop.wxss";', 'miniprogram/shared/design/loop.wxss': '@import "./rail.wxss";' };
  expect(touchFindings(railImport, cycle)).toHaveLength(1);
  expect(findings(railImport, { ...cycle, [railPath]: cycle[railPath] + '.rail { min-height:44px; }' })).toEqual([]);
});

test('rejects cross-root, remote and encoded imports even when supplied with matching data', () => {
  for (const specifier of ['../../../outside.wxss', 'https://example.test/rail.wxss', '//example.test/rail.wxss', '../../shared/design/%72ail.wxss', '../../shared/design/rail.wxss?version=1']) {
    const map = { 'outside.wxss': '.rail { min-height:44px; }', [specifier]: '.rail { min-height:44px; }', [railPath]: '.rail { min-height:44px; }' };
    expect(touchFindings(`@import "${specifier}";`, map), specifier).toHaveLength(1);
  }
});

test('later min-height zero overrides imported 44px for the same selector', () => {
  expect(touchFindings(`${railImport}\n.rail { min-height:0; }`, { [railPath]: '.rail { min-height:44px; }' })).toHaveLength(1);
  expect(touchFindings(`${railImport}\n.rail { min-height:var(--xy-control-height-compact); }`, { [railPath]: '.rail { min-height:44px; }' })).toHaveLength(1);
});

test('preserves cascade source order across nested imports and repeated declarations', () => {
  const shared = {
    [railPath]: '.rail { min-height:44px; } @import "./override.wxss";',
    'miniprogram/shared/design/override.wxss': '.rail { min-height:0; }',
  };
  expect(touchFindings(railImport, shared)).toHaveLength(1);
  expect(findings(`${railImport}.rail { min-height:var(--xy-size-touch-min); }`, shared)).toEqual([]);
});

test('respects higher specificity and important instead of accepting any historical declaration', () => {
  const markup = '<view class="container"><view class="rail" bindtap="select" role="button" /></view>';
  expect(findings(`${railImport}.rail { min-height:0; }`, { [railPath]: '.container .rail { min-height:44px; }' }, markup)).toEqual([]);
  expect(touchFindings(`${railImport}.rail { min-height:0 !important; }`, { [railPath]: '.container .rail { min-height:44px; }' }, markup)).toHaveLength(1);
  expect(touchFindings(`${railImport}.container .rail { min-height:0; }`, { [railPath]: '.rail { min-height:44px; }' }, markup)).toHaveLength(1);
});

test('conditional 44px is not global proof and a later conditional smaller size remains rejected', () => {
  expect(touchFindings('@media (min-width:430px) { .rail { min-height:44px; } }')).toHaveLength(1);
  expect(touchFindings(`${railImport}@media (max-width:375px) { .rail { min-height:0; } }`, { [railPath]: '.rail { min-height:44px; }' })).toHaveLength(1);
});

test('descendant image dimensions never prove the size of an interactive ancestor', () => {
  const markup = '<view class="address-action" bindtap="select" role="button"><image /></view>';
  expect(touchFindings('.address-action image { min-height:44px; }', {}, markup)).toHaveLength(1);
});

test('decoration image raw height is accepted while action parents and native controls still fail', () => {
  expect(findings('.address-action image { height:12px; }', {}, '<view class="address-action"><image /></view>')).toEqual([]);
  for (const selector of ['.address-action', 'button', 'input', '.address-action button', '.address-action image, button']) {
    const result = findings(`${selector} { height:12px; }`, {}, '<view />');
    expect(result.some((finding) => finding.message === 'Interactive control uses a raw fixed height.'), selector).toBe(true);
  }
});

test('an image that is itself interactive still needs a provable touch contract', () => {
  expect(touchFindings('.address-action image { height:12px; }', {}, '<view class="address-action"><image bindtap="select" role="button" /></view>')).toHaveLength(1);
});

test('shared generic native button height is resolved without a page-name or class-name exemption', () => {
  expect(findings(railImport, { [railPath]: 'button { min-height:44px; }' }, '<button class="new-transparent-hit" />')).toEqual([]);
  expect(touchFindings(railImport, { [railPath]: '.different { min-height:44px; }' }, '<button class="new-transparent-hit" />')).toHaveLength(1);
});

test('resolves page-global imports and actual root Token aliases without crossing component isolation', () => {
  const app = '@import "./shared/design/hit.wxss"; page { --xy-size-touch-min:44px; --xy-control-hit-size:var(--xy-size-touch-min); }';
  const shared = { 'miniprogram/app.wxss': app, 'miniprogram/shared/design/hit.wxss': '.rail { min-height:var(--xy-control-hit-size); }' };
  const pageFindings = (style, extra = {}) => evaluateFixtureRule('MPA-TYPE-001', new Map(Object.entries({
    ...shared,
    'miniprogram/pages/probe/index.wxml': '<page-meta root-font-size="system" /><view class="rail" bindtap="select" />',
    'miniprogram/pages/probe/index.wxss': style,
    ...extra,
  })), {}).filter((item) => item.semanticSubject.includes('touch-contract:'));
  expect(pageFindings('')).toHaveLength(0);
  expect(pageFindings('.rail { min-height:0; }')).toHaveLength(1);
  expect(pageFindings('page { --xy-control-hit-size:20px; }')).toHaveLength(1);
  expect(pageFindings('page { --xy-control-hit-size:var(--cycle); --cycle:var(--xy-control-hit-size); }')).toHaveLength(1);
  expect(touchFindings('', shared)).toHaveLength(1);
});

test('ignores descendant dimensions, active states and pseudo-elements as unconditional parent sizes', () => {
  expect(findings('.rail { min-height:44px; } .rail image { height:12px; } .rail:active { color:red; } .rail::before { min-height:0; }')).toEqual([]);
  expect(touchFindings('.rail:active { min-height:44px; } .rail::before { min-height:44px; }')).toHaveLength(1);
});

test('rejects a local Token override and shrinking calc expressions', () => {
  expect(touchFindings('page { --xy-size-touch-min:44px; } .rail { --xy-size-touch-min:0px; min-height:var(--xy-size-touch-min); }')).toHaveLength(1);
  expect(touchFindings('.rail { min-height:calc(var(--xy-size-touch-min) - 40px); }')).toHaveLength(1);
  expect(findings('.rail { --local-size:44px; min-height:var(--local-size); }')).toEqual([]);
});

test('rejects state-only shrinking overrides but accepts unrelated states and lower-priority shrink', () => {
  expect(touchFindings('.rail { min-height:44px; } .rail:active { min-height:0; }')).toHaveLength(1);
  expect(touchFindings('.rail:focus { min-height:44px; }')).toHaveLength(1);
  expect(findings('.rail { min-height:44px !important; } .rail:active { min-height:0; }')).toEqual([]);
  expect(findings('.rail { min-height:44px; } .other:active { min-height:0; }')).toEqual([]);
});

test('safely resolves positive calc addition without accepting subtraction or unknown arithmetic', () => {
  const vars = 'page { --xy-size-touch-min:44px; --xy-space-2:8px; }';
  expect(findings(`${vars}.rail { min-height:calc(var(--xy-size-touch-min) + var(--xy-space-2)); }`)).toEqual([]);
  expect(findings('.rail { min-height:calc(100rpx + 2px); }')).toEqual([]);
  expect(touchFindings('.rail { min-height:calc(90rpx + 2px); }')).toHaveLength(1);
  for (const expression of ['var(--xy-size-touch-min) - 40px', '44px + var(--unknown)', '44px * 2', '44px + -40px']) {
    expect(touchFindings(`${vars}.rail { min-height:calc(${expression}); }`), expression).toHaveLength(1);
  }
});
