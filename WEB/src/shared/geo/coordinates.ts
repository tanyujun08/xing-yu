export interface GeographicCoordinate {
  longitude: number;
  latitude: number;
}

const PI = Math.PI;
const SEMI_MAJOR_AXIS = 6378245.0;
const ECCENTRICITY_SQUARED = 0.006693421622965943;

function outsideMainlandChina(longitude: number, latitude: number): boolean {
  return longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271;
}

function transformLatitude(longitudeOffset: number, latitudeOffset: number): number {
  let result = -100 + 2 * longitudeOffset + 3 * latitudeOffset + 0.2 * latitudeOffset ** 2
    + 0.1 * longitudeOffset * latitudeOffset + 0.2 * Math.sqrt(Math.abs(longitudeOffset));
  result += (20 * Math.sin(6 * longitudeOffset * PI) + 20 * Math.sin(2 * longitudeOffset * PI)) * 2 / 3;
  result += (20 * Math.sin(latitudeOffset * PI) + 40 * Math.sin(latitudeOffset / 3 * PI)) * 2 / 3;
  result += (160 * Math.sin(latitudeOffset / 12 * PI) + 320 * Math.sin(latitudeOffset * PI / 30)) * 2 / 3;
  return result;
}

function transformLongitude(longitudeOffset: number, latitudeOffset: number): number {
  let result = 300 + longitudeOffset + 2 * latitudeOffset + 0.1 * longitudeOffset ** 2
    + 0.1 * longitudeOffset * latitudeOffset + 0.1 * Math.sqrt(Math.abs(longitudeOffset));
  result += (20 * Math.sin(6 * longitudeOffset * PI) + 20 * Math.sin(2 * longitudeOffset * PI)) * 2 / 3;
  result += (20 * Math.sin(longitudeOffset * PI) + 40 * Math.sin(longitudeOffset / 3 * PI)) * 2 / 3;
  result += (150 * Math.sin(longitudeOffset / 12 * PI) + 300 * Math.sin(longitudeOffset / 30 * PI)) * 2 / 3;
  return result;
}

/** Converts legacy WGS84 coordinates to the GCJ-02 coordinate system used by Tencent Maps. */
export function wgs84ToGcj02(coordinate: GeographicCoordinate): GeographicCoordinate {
  if (outsideMainlandChina(coordinate.longitude, coordinate.latitude)) return { ...coordinate };

  let latitudeDelta = transformLatitude(coordinate.longitude - 105, coordinate.latitude - 35);
  let longitudeDelta = transformLongitude(coordinate.longitude - 105, coordinate.latitude - 35);
  const latitudeRadians = coordinate.latitude / 180 * PI;
  let magic = Math.sin(latitudeRadians);
  magic = 1 - ECCENTRICITY_SQUARED * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  latitudeDelta = latitudeDelta * 180 / ((SEMI_MAJOR_AXIS * (1 - ECCENTRICITY_SQUARED)) / (magic * sqrtMagic) * PI);
  longitudeDelta = longitudeDelta * 180 / (SEMI_MAJOR_AXIS / sqrtMagic * Math.cos(latitudeRadians) * PI);

  return {
    longitude: coordinate.longitude + longitudeDelta,
    latitude: coordinate.latitude + latitudeDelta,
  };
}
