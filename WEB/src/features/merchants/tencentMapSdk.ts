const TENCENT_MAP_SDK_ORIGIN = 'https://map.qq.com';
const TENCENT_MAP_SDK_PATH = '/api/gljs';
const LOAD_TIMEOUT_MS = 15_000;
const SERVICE_REQUEST_TIMEOUT_MS = 12_000;

export interface TencentLatLng {
  readonly lat?: number;
  readonly lng?: number;
  getLat?(): number;
  getLng?(): number;
}

export interface TencentMapClickEvent {
  readonly latLng?: TencentLatLng;
}

export interface TencentMarkerGeometry {
  readonly id: string;
  readonly position: TencentLatLng;
}

export interface TencentMapInstance {
  on(eventName: 'click', listener: (event: TencentMapClickEvent) => void): void;
  off(eventName: 'click', listener: (event: TencentMapClickEvent) => void): void;
  setCenter(center: TencentLatLng): void;
  destroy?(): void;
}

export interface TencentMultiMarkerInstance {
  setGeometries(geometries: readonly TencentMarkerGeometry[]): void;
  setMap(map: TencentMapInstance | null): void;
}

interface TencentServiceRequestOptions {
  readonly keyword?: string;
  readonly location?: TencentLatLng;
}

interface TencentSuggestionOptions {
  readonly pageSize?: number;
  readonly region?: string;
  readonly regionFix?: boolean;
  readonly policy?: number;
}

interface TencentSuggestionInstance {
  getSuggestions(options: TencentServiceRequestOptions): Promise<unknown>;
}

interface TencentGeocoderInstance {
  getAddress(options: TencentServiceRequestOptions): Promise<unknown>;
}

export interface TencentMapNamespace {
  readonly LatLng: new (latitude: number, longitude: number) => TencentLatLng;
  readonly Map: new (
    container: HTMLElement,
    options: { readonly center: TencentLatLng; readonly zoom: number },
  ) => TencentMapInstance;
  readonly MultiMarker: new (options: {
    readonly map: TencentMapInstance;
    readonly geometries: readonly TencentMarkerGeometry[];
  }) => TencentMultiMarkerInstance;
  readonly service?: {
    readonly Suggestion: new (options: TencentSuggestionOptions) => TencentSuggestionInstance;
    readonly Geocoder: new () => TencentGeocoderInstance;
  };
}

type TencentMapWindow = Window & {
  TMap?: TencentMapNamespace;
  __xyTencentMapReady?: () => void;
};

let sdkPromise: Promise<TencentMapNamespace> | undefined;

export function withTencentServiceTimeout<T>(
  request: Promise<T>,
  timeoutMessage: string,
  timeoutMs = SERVICE_REQUEST_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    void request.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export function describeTencentServiceError(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null || !('message' in error)) return fallback;
  const message = String(error.message).trim();
  if (message === '' || message.length > 120) return fallback;
  return `${fallback}：${message}`;
}

export function buildTencentMapSdkUrl(key: string): string {
  const url = new URL(TENCENT_MAP_SDK_PATH, TENCENT_MAP_SDK_ORIGIN);
  url.searchParams.set('v', '1');
  url.searchParams.set('key', key.trim());
  url.searchParams.set('libraries', 'service');
  url.searchParams.set('callback', '__xyTencentMapReady');
  return url.toString();
}

export function loadTencentMapSdk(key: string): Promise<TencentMapNamespace> {
  const normalizedKey = key.trim();
  if (normalizedKey === '') {
    return Promise.reject(new Error('未配置腾讯地图 Key'));
  }

  const mapWindow = window as TencentMapWindow;
  if (mapWindow.TMap !== undefined) return Promise.resolve(mapWindow.TMap);
  if (sdkPromise !== undefined) return sdkPromise;

  sdkPromise = new Promise<TencentMapNamespace>((resolve, reject) => {
    const previousCallback = mapWindow.__xyTencentMapReady;
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      if (previousCallback === undefined) {
        delete mapWindow.__xyTencentMapReady;
      } else {
        mapWindow.__xyTencentMapReady = previousCallback;
      }
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      script.remove();
      sdkPromise = undefined;
      reject(new Error(message));
    };

    const timeoutId = window.setTimeout(() => fail('腾讯地图加载超时，请检查 Key、域名白名单或网络'), LOAD_TIMEOUT_MS);

    mapWindow.__xyTencentMapReady = () => {
      if (settled) return;
      if (mapWindow.TMap === undefined) {
        fail('腾讯地图 SDK 已响应，但未提供可用地图对象');
        return;
      }
      settled = true;
      cleanup();
      resolve(mapWindow.TMap);
    };

    script.charset = 'utf-8';
    script.async = true;
    script.dataset.xyTencentMapSdk = 'true';
    script.src = buildTencentMapSdkUrl(normalizedKey);
    script.onerror = () => fail('腾讯地图加载失败，请检查 Key、域名白名单或网络');
    document.head.appendChild(script);
  });

  return sdkPromise;
}
