import type { OperatingAddress } from '../../shared/services';
import { composeFullAddress } from './addressProjection';
import type { TencentLatLng } from './tencentMapSdk';

export interface AddressCandidate extends OperatingAddress {
  id: string;
  title: string;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as Readonly<Record<string, unknown>>;
}

function readText(record: Readonly<Record<string, unknown>> | undefined, key: string): string {
  const value = record?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function readTencentCoordinate(
  location: TencentLatLng,
  property: 'lat' | 'lng',
  getter: 'getLat' | 'getLng',
): number | undefined {
  const directValue = location[property];
  if (typeof directValue === 'number' && Number.isFinite(directValue)) return directValue;
  const getterFunction = location[getter];
  if (typeof getterFunction !== 'function') return undefined;
  const getterValue = getterFunction.call(location);
  return Number.isFinite(getterValue) ? getterValue : undefined;
}

export function normalizeTencentSuggestionResponse(response: unknown): AddressCandidate[] {
  const root = asRecord(response);
  const nestedResult = asRecord(root?.result);
  const rawRows = Array.isArray(root?.data)
    ? root.data
    : Array.isArray(nestedResult?.data)
      ? nestedResult.data
      : [];

  return rawRows.flatMap((rawRow, index) => {
    const row = asRecord(rawRow);
    const locationValue = row?.location;
    const location = typeof locationValue === 'object' && locationValue !== null
      ? locationValue as TencentLatLng
      : undefined;
    const adInfo = asRecord(row?.ad_info);
    const latitude = location === undefined ? undefined : readTencentCoordinate(location, 'lat', 'getLat');
    const longitude = location === undefined ? undefined : readTencentCoordinate(location, 'lng', 'getLng');
    if (latitude === undefined || longitude === undefined) return [];

    const province = readText(row, 'province') || readText(adInfo, 'province');
    const city = readText(row, 'city') || readText(adInfo, 'city');
    const district = readText(row, 'district') || readText(adInfo, 'district') || /^(.{2,8}?(?:区|县|市))/u.exec(readText(row, 'address'))?.[1] || '';
    const address = readText(row, 'address');
    if (!province || !district) return [];
    const title = readText(row, 'title');
    const detailAddress = address || title;
    const operatingAddress: OperatingAddress = {
      provinceCode: '', cityCode: '', districtCode: readText(adInfo, 'adcode'),
      province, city, district,
      poiName: title || null,
      detailAddress,
      fullAddress: composeFullAddress({ province, city, district, detailAddress }),
      longitude,
      latitude,
      confirmationStatus: 'TENCENT_CONFIRMED',
    };

    return [{
      ...operatingAddress,
      id: readText(row, 'id') || `${latitude}-${longitude}-${index}`,
      title: title || operatingAddress.fullAddress,
    }];
  });
}

export function normalizeTencentGeocoderResponse(
  response: unknown,
  fallback: OperatingAddress,
): OperatingAddress {
  const root = asRecord(response);
  const result = asRecord(root?.result) ?? root;
  const components = asRecord(result?.address_component);
  const province = readText(components, 'province');
  const city = readText(components, 'city');
  const district = readText(components, 'district');
  if (!province || !district) throw new Error('腾讯地图未返回完整行政区划，请重新选址');
  const street = readText(components, 'street');
  const streetNumber = readText(components, 'street_number');
  const returnedFullAddress = readText(result, 'address');
  const detailAddress = `${street}${streetNumber}` || returnedFullAddress;

  return {
    latitude: fallback.latitude, longitude: fallback.longitude,
    provinceCode: '', cityCode: '', districtCode: readText(asRecord(result?.ad_info), 'adcode'), poiName: null,
    province, city, district,
    detailAddress,
    fullAddress: returnedFullAddress || composeFullAddress({ province, city, district, detailAddress }),
    confirmationStatus: 'TENCENT_CONFIRMED',
  };
}
