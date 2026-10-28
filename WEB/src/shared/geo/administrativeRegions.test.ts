import { describe, expect, it } from 'vitest';
import {
  administrativeRegionMetadata,
  administrativeRegionTree,
  findAdministrativePathByCodes,
  findAdministrativePathByDistrictCode,
  resolveAdministrativePath,
} from './administrativeRegions';

describe('administrative region snapshot', () => {
  it('pins the approved source identity and excludes Hong Kong, Macao and Taiwan', () => {
    expect(administrativeRegionMetadata.sourceCommit).toBe('99add0f3eb797c28a6f781c801205f03aff3415a');
    expect(administrativeRegionMetadata.datasetVersion).toBe('2026-04');
    expect(administrativeRegionMetadata.license).toBe('MIT');
    expect(administrativeRegionMetadata.sourceSha256).toBe('848d00f6e09ea3d292c666648f763920ab8c94b8c83874971c680bf168cf307a');
    expect(administrativeRegionMetadata.normalizedSha256).toBe('34eaba228ad47abab272f215e3453e54ea5b16b085759f21e889a0753bb39150');
    expect(administrativeRegionTree.some((province) => ['71', '81', '82'].includes(province.code.slice(0, 2)))).toBe(false);
  });

  it('resolves municipalities and province-direct county paths deterministically', () => {
    expect(findAdministrativePathByCodes(['110000', '110100', '110101'])?.district.name).toBe('东城区');
    expect(findAdministrativePathByDistrictCode('500101')?.city.code).toBe('500100');
    expect(findAdministrativePathByDistrictCode('419001')?.city.code).toBe('419000');
  });

  it('falls back from Tencent-style region names without guessing outside the snapshot', () => {
    expect(resolveAdministrativePath({ province: '广东省', city: '深圳市', district: '宝安区' })?.district.code).toBe('440306');
    expect(resolveAdministrativePath({ province: '香港特别行政区', city: '香港', district: '中西区' })).toBeNull();
  });
});
