import type { MerchantGateway, OperatingAddress } from '../../shared/services/contracts';

export type RegionLoader = NonNullable<MerchantGateway['listRegions']>;
export type RegionNode = Awaited<ReturnType<RegionLoader>>['items'][number];
export type RegionOption = { label: string; value: string; region: RegionNode; children?: true | RegionOption[] };
export const regionOption = (region: RegionNode): RegionOption => ({ label: region.codeKind === 'SOURCE_EXTENSION' ? `${region.name}（来源扩展编码）` : region.isVirtual ? `${region.name}（联动层级）` : region.name, value: region.id, region, ...(region.level === 'DISTRICT' ? {} : { children: true as const }) });
const normalized = (name: string) => name.trim().replace(/(特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|省|市)$/u, '');
function unique(items: RegionNode[], label: string): RegionNode {
  if (items.length !== 1) throw new Error(`当前生效区划无法唯一匹配${label}，请调整地图位置或维护区划`);
  return items[0]!;
}
export async function resolveMapRegion(address: OperatingAddress, load: RegionLoader, signal: AbortSignal) {
  signal.throwIfAborted();
  const root = await load('', '', { signal });
  const dataset = root.datasetId;
  if (!dataset) throw new Error('当前生效区划不可用');
  const province = unique(root.items.filter((n) => n.level === 'PROVINCE' && n.parentId === null && normalized(n.name) === normalized(address.province)), '省');
  const read = async (parent: RegionNode, level: RegionNode['level']) => {
    signal.throwIfAborted();
    const result = await load(dataset, parent.id, { signal });
    signal.throwIfAborted();
    if (result.datasetId !== dataset) throw new Error('区划版本已变化，请重新选址');
    return result.items.filter((n) => n.parentId === parent.id && n.level === level);
  };
  const cities = await read(province, 'CITY');
  // Virtual CITY nodes are real API nodes, including municipality wrappers.
  const cityCandidates = cities.filter((n) => n.isVirtual || normalized(n.name) === normalized(address.city));
  const paths: Array<{ city: RegionNode; district: RegionNode; districts: RegionNode[] }> = [];
  for (const city of cityCandidates) {
    const districts = await read(city, 'DISTRICT');
    const exact = address.districtCode ? districts.filter((n) => n.code === address.districtCode) : [];
    const matches = exact.length ? exact : districts.filter((n) => n.name === address.district);
    for (const district of matches) paths.push({ city, district, districts });
  }
  if (paths.length !== 1) throw new Error('当前生效区划无法唯一匹配所选城市和区县，请调整地图位置或维护区划');
  const { city, district, districts } = paths[0]!;
  const latest = await load('', '', { signal });
  signal.throwIfAborted();
  if (latest.datasetId !== dataset) throw new Error('区划版本已变化，请重新选址');
  const options = root.items.map((p) => p.id !== province.id ? regionOption(p) : { ...regionOption(p), children: cities.map((c) => c.id !== city.id ? regionOption(c) : { ...regionOption(c), children: districts.map(regionOption) }) });
  return { options, address: { ...address, datasetId: dataset, provinceId: province.id, cityId: city.id, districtId: district.id, provinceCode: province.code, cityCode: city.code, districtCode: district.code, province: province.name, city: city.name, district: district.name } };
}

export function confirmedOperatingAddress(form: Omit<OperatingAddress, 'longitude' | 'latitude' | 'confirmationStatus'> & { longitude: number | ''; latitude: number | ''; confirmationStatus: string }): OperatingAddress {
  if (form.confirmationStatus !== 'TENCENT_CONFIRMED') throw new Error('请通过腾讯地图重新确认地址');
  return { ...(form.datasetId ? { datasetId: form.datasetId } : {}), ...(form.provinceId ? { provinceId: form.provinceId } : {}), ...(form.cityId ? { cityId: form.cityId } : {}), ...(form.districtId ? { districtId: form.districtId } : {}), provinceCode: form.provinceCode, cityCode: form.cityCode, districtCode: form.districtCode, province: form.province, city: form.city, district: form.district, poiName: form.poiName, detailAddress: form.detailAddress, fullAddress: form.fullAddress, longitude: typeof form.longitude === 'number' ? form.longitude : Number.NaN, latitude: typeof form.latitude === 'number' ? form.latitude : Number.NaN, confirmationStatus: 'TENCENT_CONFIRMED' };
}
