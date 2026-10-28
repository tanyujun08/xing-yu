import type { OperatingAddress } from '../../shared/services';

function uniqueRegionParts(province: string, city: string, district: string): string[] {
  return [province, city, district]
    .map((part) => part.trim())
    .filter((part, index, values) => part !== '' && values.indexOf(part) === index);
}

export function composeFullAddress(
  address: Pick<OperatingAddress, 'province' | 'city' | 'district' | 'detailAddress'>,
): string {
  const regionParts = uniqueRegionParts(address.province, address.city, address.district);
  const region = regionParts.join('');
  const detail = address.detailAddress.trim();
  if (detail === '') return region;
  if (detail.startsWith(region)) return detail;
  const firstIncludedRegionIndex = regionParts.findIndex((part) => detail.startsWith(part));
  if (firstIncludedRegionIndex >= 0) return `${regionParts.slice(0, firstIncludedRegionIndex).join('')}${detail}`;
  return `${region}${detail}`;
}
