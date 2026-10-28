import { describe, expect, it } from 'vitest';
import { wgs84ToGcj02 } from './coordinates';

describe('wgs84ToGcj02', () => {
  it('converts a mainland WGS84 coordinate to Tencent Maps GCJ-02 coordinates', () => {
    const converted = wgs84ToGcj02({ longitude: 116.397128, latitude: 39.916527 });

    expect(converted.longitude).toBeCloseTo(116.403372, 5);
    expect(converted.latitude).toBeCloseTo(39.917931, 5);
  });

  it('keeps coordinates outside mainland China unchanged', () => {
    expect(wgs84ToGcj02({ longitude: -0.1276, latitude: 51.5072 })).toEqual({
      longitude: -0.1276,
      latitude: 51.5072,
    });
  });
});
