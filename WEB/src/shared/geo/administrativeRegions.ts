import regionData from './data/administrative-regions.json';
import regionMeta from './data/administrative-regions.meta.json';

export interface AdministrativeRegionNode {
  code: string;
  name: string;
  children?: AdministrativeRegionNode[];
}

export interface AdministrativeRegionPath {
  province: AdministrativeRegionNode;
  city: AdministrativeRegionNode;
  district: AdministrativeRegionNode;
}

export const administrativeRegionTree = regionData as AdministrativeRegionNode[];
export const administrativeRegionMetadata = regionMeta;

export const administrativeCascaderOptions = administrativeRegionTree.map((province) => ({
  label: province.name,
  value: province.code,
  children: (province.children ?? []).map((city) => ({
    label: city.name,
    value: city.code,
    children: (city.children ?? []).map((district) => ({
      label: district.name,
      value: district.code,
    })),
  })),
}));

export function findAdministrativePathByCodes(codes: readonly string[]): AdministrativeRegionPath | null {
  if (codes.length !== 3) return null;
  const province = administrativeRegionTree.find((candidate) => candidate.code === codes[0]);
  const city = province?.children?.find((candidate) => candidate.code === codes[1]);
  const district = city?.children?.find((candidate) => candidate.code === codes[2]);
  return province !== undefined && city !== undefined && district !== undefined
    ? { province, city, district }
    : null;
}

export function findAdministrativePathByDistrictCode(districtCode: string): AdministrativeRegionPath | null {
  for (const province of administrativeRegionTree) {
    for (const city of province.children ?? []) {
      const district = city.children?.find((candidate) => candidate.code === districtCode);
      if (district !== undefined) return { province, city, district };
    }
  }
  return null;
}

function normalizeRegionName(value: string): string {
  return value.trim().replace(/(特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|自治州|自治县|地区|盟|省|市|区|县)$/u, '');
}

export function findAdministrativePathByNames(names: readonly string[]): AdministrativeRegionPath | null {
  if (names.length !== 3) return null;
  const normalized = names.map(normalizeRegionName);
  for (const province of administrativeRegionTree) {
    if (normalizeRegionName(province.name) !== normalized[0]) continue;
    for (const city of province.children ?? []) {
      if (normalizeRegionName(city.name) !== normalized[1]) continue;
      const district = city.children?.find((candidate) => normalizeRegionName(candidate.name) === normalized[2]);
      if (district !== undefined) return { province, city, district };
    }
  }
  return null;
}

export function resolveAdministrativePath(input: {
  adcode?: string | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  addressText?: string | null;
}): AdministrativeRegionPath | null {
  if (input.adcode !== undefined && input.adcode !== null) {
    const byCode = findAdministrativePathByDistrictCode(input.adcode);
    if (byCode !== null) return byCode;
  }
  if (input.province !== undefined && input.city !== undefined && input.district !== undefined) {
    const byNames = findAdministrativePathByNames([input.province ?? '', input.city ?? '', input.district ?? '']);
    if (byNames !== null) return byNames;
  }
  const addressText = input.addressText?.trim() ?? '';
  if (addressText !== '') {
    const matches: AdministrativeRegionPath[] = [];
    for (const province of administrativeRegionTree) for (const city of province.children ?? []) for (const district of city.children ?? []) {
      if (addressText.includes(district.name) && (addressText.includes(city.name) || city.name === '市辖区' || city.name === '县')) {
        matches.push({ province, city, district });
      }
    }
    if (matches.length === 1) return matches[0]!;
  }
  return null;
}
