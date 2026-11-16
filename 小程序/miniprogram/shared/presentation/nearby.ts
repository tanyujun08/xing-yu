import { navigableLocation } from './store-details';

export type Point = { latitude: number; longitude: number };
export type PointLike = { latitude: string; longitude: string; coordinate_system: string } | null | undefined;

/** Only reads the position when the user has already allowed it; never opens a permission prompt. */
export function readAuthorizedPoint(): Promise<Point | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 3000);
    const done = (value: Point | null) => { clearTimeout(timer); resolve(value); };
    wx.getSetting({
      success: (setting) => {
        if (!setting.authSetting['scope.userLocation']) { done(null); return; }
        wx.getLocation({ type: 'gcj02', success: (res) => done({ latitude: res.latitude, longitude: res.longitude }), fail: () => done(null) });
      },
      fail: () => done(null),
    });
  });
}

export function pointOf(location: PointLike): Point | null { return navigableLocation(location); }

export function distanceMeters(a: Point, b: Point): number {
  const rad = Math.PI / 180, dLat = (b.latitude - a.latitude) * rad, dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}

export function distanceLabel(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

export function distanceFrom(origin: Point | null, location: PointLike): { meters: number; label: string } | null {
  const target = pointOf(location);
  if (!origin || !target) return null;
  const meters = distanceMeters(origin, target);
  return { meters, label: distanceLabel(meters) };
}
