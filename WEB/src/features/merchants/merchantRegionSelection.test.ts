import { describe, expect, test, vi } from 'vitest';
import { confirmedOperatingAddress, resolveMapRegion, type RegionLoader, type RegionNode } from './merchantRegionSelection';
import type { OperatingAddress } from '../../shared/services';
const node = (id: string, parentId: string | null, name: string, level: RegionNode['level'], code: string, isVirtual = false): RegionNode => ({ id, parentId, name, level, code, isVirtual, codeKind: 'NATIONAL' });
const a: OperatingAddress = { province: '广东省', city: '深圳市', district: '福田区', provinceCode: '', cityCode: '', districtCode: '440304', poiName: null, detailAddress: '公共路', fullAddress: '广东省深圳市福田区公共路', latitude: 22.5, longitude: 114, confirmationStatus: 'TENCENT_CONFIRMED' };
function fixture() {
 const tree: Record<string, RegionNode[]> = { '': [node('p', null, '广东省', 'PROVINCE', '440000')], p: [node('c', 'p', '深圳市', 'CITY', '440300')], c: [node('d', 'c', '福田区', 'DISTRICT', '440304')] };
 const load = vi.fn<RegionLoader>(async (_dataset, parent = '') => ({ datasetId: 'active', items: tree[parent] ?? [] }));
 return { tree, load };
}
describe('active region map binding', () => {
 test('hydrates real node path and keeps all four IDs through submission mapping', async () => {
  const { load } = fixture(); const r = await resolveMapRegion(a, load, new AbortController().signal);
  expect(confirmedOperatingAddress(r.address)).toMatchObject({ datasetId: 'active', provinceId: 'p', cityId: 'c', districtId: 'd', longitude: 114 });
  expect(r.options[0]).toMatchObject({ value: 'p', children: [{ value: 'c', children: [{ value: 'd' }] }] });
 });
 test('resolves a municipality through its actual virtual CITY node', async () => {
  const { tree, load } = fixture(); tree['']![0]!.name = '北京市'; tree.p![0]!.name = '市辖区'; tree.p![0]!.isVirtual = true; tree.c![0]!.name = '海淀区';tree.c![0]!.code = '110108';
  const r = await resolveMapRegion({ ...a, province: '北京市', city: '北京市', district: '海淀区', districtCode: '110108' }, load, new AbortController().signal);
  expect(r.address).toMatchObject({ cityId: 'c', city: '市辖区', districtId: 'd' });
 });
 test('rejects ambiguous nodes instead of taking first', async () => {
  const { tree, load } = fixture();tree.c!.push({ ...tree.c![0]!, id: 'duplicate' });
  await expect(resolveMapRegion(a, load, new AbortController().signal)).rejects.toThrow('唯一');
 });
 test('rejects current dataset changes and canceled resolution', async () => {
  const { load } = fixture(); load.mockResolvedValueOnce({ datasetId: 'old', items: [node('p', null, '广东省', 'PROVINCE', '440000')] });
  await expect(resolveMapRegion(a, load, new AbortController().signal)).rejects.toThrow('版本');
  const controller = new AbortController();controller.abort();await expect(resolveMapRegion(a, load, controller.signal)).rejects.toThrow();
 });
 test('rejects absent district without creating or inferring a node', async () => {
  const { tree, load } = fixture();tree.c = [];
  await expect(resolveMapRegion(a, load, new AbortController().signal)).rejects.toThrow('唯一');
 });
});
