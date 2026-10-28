import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { findRegionPath, formatRegion } from '../miniprogram/shared/presentation/address-region';
const children = vi.hoisted(() => vi.fn((dataset?: string, parent?: string) => {
  const rows: Record<string, {region_id: string; name: string; level: string; code_kind?: string}[]> = {
    root: [{region_id:'44',name:'广东省',level:'PROVINCE'},{region_id:'33',name:'浙江省',level:'PROVINCE'}],
    '44': [{region_id:'4401',name:'广州市',level:'CITY'}],
    '4401': [{region_id:'440106',name:'天河区',level:'DISTRICT'}],
    '33': [],
  };
  return {promise:Promise.resolve({dataset_id:dataset ?? 'dataset-test',items:rows[parent ?? 'root'] ?? []})};
}));
vi.mock('../miniprogram/shared/api/account-api', () => ({accountApi:{sessionIdentity:()=> 'account-test'}, regionApi:{children},addressApi:{},findOwnAddress:vi.fn()}));
interface Harness { data: Record<string, unknown>; setData(patch: Record<string, unknown>): void; [key: string]: unknown }
let definition: Harness;
beforeAll(async () => { vi.stubGlobal('Page', (value: Harness) => { definition = value; }); await import('../miniprogram/pages/address-edit/index'); });
afterAll(() => vi.unstubAllGlobals());
function page(): Harness { return { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } }; }
function call(target: Harness, method: string, dataset = {}) { return (target[method] as (event: unknown) => unknown).call(target, { currentTarget: { dataset } }); }
test('API province and city remain drafts; only district commits', async () => {
  const target = page(); await call(target,'openRegionSheet'); await call(target,'chooseRegion',{code:'44'});
  expect(target.data.regionLevel).toBe(1); expect(target.data.region).toBe('请选择地区'); expect(target.data.dirty).toBe(false);
  await call(target,'chooseRegion',{code:'4401'}); expect(target.data.regionLevel).toBe(2);
  await call(target,'chooseRegion',{code:'440106'});
  expect(target.data.region).toBe('广东省广州市天河区'); expect(target.data.regionSheetOpen).toBe(false); expect(target.data.datasetId).toBe('dataset-test');
});
test('cancel and reopen discard temporary choices without invented default', async () => {
  const target=page(); await call(target,'openRegionSheet'); await call(target,'chooseRegion',{code:'44'}); call(target,'closeRegionSheet');
  expect(target.data.region).toBe('请选择地区'); expect(target.data.dirty).toBe(false);
  await call(target,'openRegionSheet'); expect(target.data.regionDraft).toEqual([]);
});
test('province reselection resets descendants and preserves uncommitted old display', async () => {
  const target=page(); target.data.region='旧地区原文'; await call(target,'openRegionSheet'); call(target,'closeRegionSheet'); expect(target.data.region).toBe('旧地区原文');
  await call(target,'openRegionSheet'); await call(target,'chooseRegion',{code:'44'}); await call(target,'chooseRegion',{code:'4401'});
  await call(target,'changeRegionLevel',{level:0}); await call(target,'chooseRegion',{code:'33'});
  expect(target.data.regionDraft).toHaveLength(1); expect(target.data.regionLevel).toBe(1); expect(target.data.region).toBe('旧地区原文');
});
test('editing a historical address opens the current dictionary and restores the old dataset on cancel', async () => {
  const target=page(); target.data.datasetId='regions-sz-v1'; target.data.regionDraft=[{code:'44-old',name:'广东省',level:'PROVINCE'}];
  children.mockClear(); await call(target,'openRegionSheet');
  expect(children).toHaveBeenCalledWith(undefined,undefined);
  expect(target.data.datasetId).toBe('dataset-test'); expect(target.data.regionDraft).toEqual([]);
  call(target,'closeRegionSheet');
  expect(target.data.datasetId).toBe('regions-sz-v1');
  expect(target.data.regionDraft).toEqual([{code:'44-old',name:'广东省',level:'PROVINCE'}]);
});
test('legacy presentation helper preserves municipality display', () => {
  for(const region of ['上海市徐汇区','北京市东城区','广东省广州市天河区']) expect(formatRegion(findRegionPath(region))).toBe(region);
});
test('address picker shows names without region provenance labels', async () => {
  children.mockImplementationOnce(() => ({ promise: Promise.resolve({ dataset_id: 'dataset-test', items: [
    { region_id: '83', name: '台湾省', level: 'PROVINCE', code_kind: 'SOURCE_EXTENSION' },
  ] }) }));
  const target = page();
  await call(target, 'openRegionSheet');
  expect(target.data.regionOptions).toEqual([{ code: '83', name: '台湾省', level: 'PROVINCE' }]);
  const markup = readFileSync(new URL('../miniprogram/pages/address-edit/index.wxml', import.meta.url), 'utf8');
  expect(markup).not.toMatch(/来源扩展编码|联动层级|联动末级|历史来源未核验|item\.hint/);
});
