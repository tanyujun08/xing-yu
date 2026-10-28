import { useEffect, useRef, useState } from 'react';
import { Button, Input, Loading } from 'tdesign-react';
import { LocationIcon, SearchIcon } from 'tdesign-icons-react';
import type { OperatingAddress } from '../../shared/services';
import { publicEnv } from '../../shared/config/env';
import {
  describeTencentServiceError,
  loadTencentMapSdk,
  type TencentLatLng,
  type TencentMapInstance,
  type TencentMapNamespace,
  type TencentMultiMarkerInstance,
  withTencentServiceTimeout,
} from './tencentMapSdk';
import {
  normalizeTencentGeocoderResponse,
  normalizeTencentSuggestionResponse,
  readTencentCoordinate,
  type AddressCandidate,
} from './tencentAddressProjection';

interface TencentAddressPickerProps {
  value: OperatingAddressDraft;
  onChange: (value: OperatingAddress, signal: AbortSignal) => void | OperatingAddress | Promise<void | OperatingAddress>;
}

type OperatingAddressDraft = Omit<OperatingAddress, 'longitude' | 'latitude'> & {
  longitude: number | '';
  latitude: number | '';
};

type MapLoadState = 'missing-key' | 'loading' | 'ready' | 'error';

function searchTencentAddress(
  sdk: TencentMapNamespace,
  keyword: string,
  region: string,
  location: TencentLatLng,
): Promise<AddressCandidate[]> {
  if (sdk.service === undefined) return Promise.reject(new Error('腾讯地图服务类库不可用'));
  const suggestion = new sdk.service.Suggestion({
    pageSize: 8,
    region: region || '深圳市',
    regionFix: false,
    policy: 1,
  });
  return withTencentServiceTimeout(
    suggestion.getSuggestions({ keyword, location }),
    '地址搜索超时，请检查 Key 权限、域名白名单或网络',
  )
    .then(normalizeTencentSuggestionResponse)
    .catch((error: unknown) => Promise.reject(new Error(
      error instanceof Error && error.message.startsWith('地址搜索超时')
        ? error.message
        : describeTencentServiceError(error, '地址搜索失败'),
    )));
}

function reverseGeocodeTencentAddress(
  sdk: TencentMapNamespace,
  location: TencentLatLng,
  fallback: OperatingAddress,
): Promise<OperatingAddress> {
  if (sdk.service === undefined) return Promise.reject(new Error('腾讯地图服务类库不可用'));
  const geocoder = new sdk.service.Geocoder();
  return withTencentServiceTimeout(
    geocoder.getAddress({ location }),
    '坐标解析超时，请检查 Key 权限、域名白名单或网络',
  )
    .then((response) => normalizeTencentGeocoderResponse(response, fallback))
    .catch((error: unknown) => Promise.reject(new Error(
      error instanceof Error && error.message.startsWith('坐标解析超时')
        ? error.message
        : describeTencentServiceError(error, '坐标解析失败'),
    )));
}

function selectedGeometry(position: TencentLatLng) {
  return [{ id: 'operating-address', position }] as const;
}

function addressSignature(address: OperatingAddressDraft): string {
  return [
    address.province,
    address.city,
    address.district,
    address.detailAddress,
    address.fullAddress,
    address.longitude,
    address.latitude,
    address.confirmationStatus,
  ].join('\u001f');
}

function hasConfirmedCoordinate(address: OperatingAddressDraft): address is OperatingAddress {
  return typeof address.longitude === 'number' && Number.isFinite(address.longitude)
    && typeof address.latitude === 'number' && Number.isFinite(address.latitude);
}

const FALLBACK_MAP_CENTER = { longitude: 114.0579, latitude: 22.5431 } as const;

export function TencentAddressPicker({ value, onChange }: TencentAddressPickerProps) {
  const [detail, setDetail] = useState(value.detailAddress || '星遇路 1 号创意园一层');
  const [busy, setBusy] = useState(false);
  return <section className="preview-offline-map">
    <h4>位置示意</h4><p>广东省 · 深圳市 · 南山区</p>
    <Input value={detail} placeholder="填写预览地址" onChange={setDetail} />
    <p>该位置仅用于本地页面预览。</p>
    <Button theme="primary" loading={busy} onClick={() => {
      const address: OperatingAddress = { ...value, datasetId: 'preview-regions', provinceId: '440000', cityId: '440300', districtId: '440303',
        provinceCode: '440000', cityCode: '440300', districtCode: '440303', province: '广东省', city: '深圳市', district: '南山区',
        detailAddress: detail, fullAddress: `广东省深圳市南山区${detail}`, poiName: '星遇创意园', latitude: 22.54, longitude: 113.94,
        confirmationStatus: 'TENCENT_CONFIRMED' };
      setBusy(true); void Promise.resolve(onChange(address, new AbortController().signal)).finally(() => setBusy(false));
    }}>使用这个预览地址</Button>
  </section>;
}

/** Source reference retained; the offline preview uses the local picker above. */
export function OriginalTencentAddressPicker({ value, onChange }: TencentAddressPickerProps) {
  const hasMapKey = publicEnv.tencentMapKey !== '';
  const valueLatitude = value.latitude;
  const valueLongitude = value.longitude;
  const [loadState, setLoadState] = useState<MapLoadState>(hasMapKey ? 'loading' : 'missing-key');
  const [loadError, setLoadError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResults, setSearchResults] = useState<AddressCandidate[]>([]);
  const [selectionMessage, setSelectionMessage] = useState('');
  const [sdk, setSdk] = useState<TencentMapNamespace>();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<TencentMapInstance | undefined>(undefined);
  const markerRef = useRef<TencentMultiMarkerInstance | undefined>(undefined);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const reverseRequestRef = useRef(0);
  const selectionAbortRef = useRef<AbortController | null>(null);
  const startSelection = () => { selectionAbortRef.current?.abort(); const controller = new AbortController(); selectionAbortRef.current = controller; return controller; };
  const searchRequestRef = useRef(0);
  const expectedValueSignatureRef = useRef('');

  const valueSignature = addressSignature(value);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => {
    if (expectedValueSignatureRef.current === valueSignature) expectedValueSignatureRef.current = '';
    else { reverseRequestRef.current += 1; selectionAbortRef.current?.abort(); }
  }, [valueSignature]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!hasMapKey) return undefined;
    let cancelled = false;
    void loadTencentMapSdk(publicEnv.tencentMapKey)
      .then((loadedSdk) => {
        if (cancelled) return;
        setSdk(loadedSdk);
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : '腾讯地图加载失败');
        setLoadState('error');
      });
    return () => { cancelled = true; };
  }, [hasMapKey]);

  const emitChange = async (address: OperatingAddress, signal: AbortSignal) => {
    expectedValueSignatureRef.current = addressSignature(address);
    signal.throwIfAborted();
    const accepted = await onChangeRef.current(address, signal);
    if (accepted) expectedValueSignatureRef.current = addressSignature(accepted);
    signal.throwIfAborted();
  };

  useEffect(() => {
    if (sdk === undefined || mapContainerRef.current === null) return undefined;

    const initialValue = valueRef.current;
    const center = new sdk.LatLng(
      hasConfirmedCoordinate(initialValue) ? initialValue.latitude : FALLBACK_MAP_CENTER.latitude,
      hasConfirmedCoordinate(initialValue) ? initialValue.longitude : FALLBACK_MAP_CENTER.longitude,
    );
    let map: TencentMapInstance;
    let marker: TencentMultiMarkerInstance;
    try {
      map = new sdk.Map(mapContainerRef.current, { center, zoom: 16 });
      marker = new sdk.MultiMarker({ map, geometries: hasConfirmedCoordinate(initialValue) ? selectedGeometry(center) : [] });
    } catch {
      const errorTimer = window.setTimeout(() => {
        setSdk(undefined);
        setLoadState('error');
        setLoadError('腾讯地图初始化失败，无法创建或更新经营位置');
      }, 0);
      return () => window.clearTimeout(errorTimer);
    }
    mapRef.current = map;
    markerRef.current = marker;

    const handleMapClick = (event: { readonly latLng?: TencentLatLng }) => {
      if (event.latLng === undefined) return;
      const latitude = readTencentCoordinate(event.latLng, 'lat', 'getLat');
      const longitude = readTencentCoordinate(event.latLng, 'lng', 'getLng');
      if (latitude === undefined || longitude === undefined) {
        setSelectionMessage('无法读取所选地图坐标，请重新点击地图或使用地址搜索');
        return;
      }
      const controller = startSelection();
      const previousAddress = valueRef.current;
      const requestId = reverseRequestRef.current + 1;
      reverseRequestRef.current = requestId;
      const coordinateAddress = {
        ...valueRef.current,
        latitude,
        longitude,
        confirmationStatus: 'TENCENT_CONFIRMED' as const,
      };
      marker.setGeometries(selectedGeometry(event.latLng));
      setSelectionMessage('已选择地图坐标，正在解析地址');
      void reverseGeocodeTencentAddress(sdk, event.latLng, coordinateAddress)
        .then(async (address) => {
          if (reverseRequestRef.current !== requestId || controller.signal.aborted) return;
          await emitChange(address, controller.signal);
          setSelectionMessage('已根据地图坐标回填经营地址');
        })
        .catch((error: unknown) => {
          if (reverseRequestRef.current !== requestId || controller.signal.aborted) return;
          if (hasConfirmedCoordinate(previousAddress)) {
            const previousPosition = new sdk.LatLng(previousAddress.latitude, previousAddress.longitude);
            map.setCenter(previousPosition);
            marker.setGeometries(selectedGeometry(previousPosition));
          } else {
            marker.setGeometries([]);
          }
          setSelectionMessage(error instanceof Error ? `${error.message}；本次地图坐标未保存` : '坐标解析失败，本次地图坐标未保存');
        });
    };

    map.on('click', handleMapClick);
    return () => {
      reverseRequestRef.current += 1;
      selectionAbortRef.current?.abort();
      map.off('click', handleMapClick);
      marker.setMap(null);
      map.destroy?.();
      markerRef.current = undefined;
      mapRef.current = undefined;
    };
  }, [sdk]);

  useEffect(() => {
    if (sdk === undefined || mapRef.current === undefined || markerRef.current === undefined) return;
    const latitude = valueLatitude;
    const longitude = valueLongitude;
    if (typeof latitude !== 'number' || !Number.isFinite(latitude)
      || typeof longitude !== 'number' || !Number.isFinite(longitude)) {
      markerRef.current.setGeometries([]);
      return;
    }
    const position = new sdk.LatLng(latitude, longitude);
    mapRef.current.setCenter(position);
    markerRef.current.setGeometries(selectedGeometry(position));
  }, [sdk, valueLatitude, valueLongitude]);

  const requestMap = async () => {
    if (!hasMapKey || loadState === 'loading') return;
    setLoadState('loading');
    setLoadError('');
    try {
      const loadedSdk = await loadTencentMapSdk(publicEnv.tencentMapKey);
      setSdk(loadedSdk);
      setLoadState('ready');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '腾讯地图加载失败');
      setLoadState('error');
    }
  };

  const runSearch = async () => {
    const keyword = searchText.trim();
    if (sdk === undefined || keyword === '') return;
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setSearching(true);
    setSearchError('');
    setSearchResults([]);
    try {
      const location = new sdk.LatLng(
        hasConfirmedCoordinate(value) ? value.latitude : FALLBACK_MAP_CENTER.latitude,
        hasConfirmedCoordinate(value) ? value.longitude : FALLBACK_MAP_CENTER.longitude,
      );
      const searchRegion = ['市辖区', '县', '省直辖县级行政区划', '自治区直辖县级行政区划'].includes(value.city) ? value.province : value.city;
      const results = await searchTencentAddress(sdk, keyword, searchRegion, location);
      if (searchRequestRef.current !== requestId) return;
      setSearchResults(results);
      if (results.length === 0) setSearchError('未找到匹配地址，请调整关键词或直接点击地图选址');
    } catch (error) {
      if (searchRequestRef.current !== requestId) return;
      setSearchError(error instanceof Error ? error.message : '地址搜索失败');
    } finally {
      if (searchRequestRef.current === requestId) setSearching(false);
    }
  };

  const chooseCandidate = async (candidate: AddressCandidate) => {
    const address: OperatingAddress = {
      ...candidate,
    };
    const controller = startSelection();
    setSearchResults([]);
    if (sdk === undefined) {
      setSelectionMessage(`已选择：${candidate.title}`);
      return;
    }

    const requestId = reverseRequestRef.current + 1;
    reverseRequestRef.current = requestId;
    setSelectionMessage(`已选择：${candidate.title}，正在确认完整行政区划`);
    try {
      const confirmedAddress = await reverseGeocodeTencentAddress(
        sdk,
        new sdk.LatLng(candidate.latitude, candidate.longitude),
        address,
      );
      if (reverseRequestRef.current !== requestId || controller.signal.aborted) return;
      await emitChange(confirmedAddress, controller.signal);
      setSelectionMessage(`已回填：${confirmedAddress.fullAddress}`);
    } catch (error) {
      if (reverseRequestRef.current !== requestId || controller.signal.aborted) return;
      setSelectionMessage(error instanceof Error
        ? `${error.message}；本次地图选址未保存`
        : '地址行政区划确认失败，本次地图选址未保存');
    }
  };

  return (
    <section className="tencent-address-picker" aria-labelledby="tencent-map-picker-title">
      <div className="tencent-address-picker__heading">
        <div>
          <strong id="tencent-map-picker-title">腾讯地图选址</strong>
          <span>地图坐标使用 GCJ-02；键盘用户可通过地址搜索结果选址。</span>
        </div>
        {loadState === 'ready' ? <span className="tencent-address-picker__ready">地图已连接</span> : null}
      </div>

      {loadState === 'missing-key' ? (
        <div className="tencent-address-picker__status" role="status">
          未配置 <code>VITE_TENCENT_MAP_KEY</code>，无法创建或更新经营位置；坐标只能由腾讯地图选址产生。
        </div>
      ) : null}

      {loadState === 'error' ? (
        <div className="tencent-address-picker__load-row">
          <Button variant="outline" icon={<LocationIcon />} onClick={() => void requestMap()}>
            重新加载腾讯地图
          </Button>
          <span role="alert">{loadError || '腾讯地图加载失败，无法创建或更新经营位置'}</span>
        </div>
      ) : null}

      {loadState === 'loading' ? (
        <div className="tencent-address-picker__loading" role="status">
          <Loading size="small" /> 正在加载腾讯地图
        </div>
      ) : null}

      {loadState === 'ready' ? (
        <>
          <div className="tencent-address-picker__search">
            <label htmlFor="merchant-map-search">搜索经营地址</label>
            <div>
              <Input
                ref={(control) => { if (control?.inputElement) control.inputElement.id = 'merchant-map-search'; }}
                className="tencent-address-picker__search-input"
                value={searchText}
                placeholder="输入道路、门牌或场所名称"
                onChange={(value) => {
                  searchRequestRef.current += 1;
                  reverseRequestRef.current += 1;
      selectionAbortRef.current?.abort();
                  setSearching(false);
                  setSearchResults([]);
                  setSearchError('');
                  setSearchText(String(value));
                }}
                onEnter={(_, { e }) => {
                  e.preventDefault();
                  void runSearch();
                }}
              />
              <Button
                theme="primary"
                icon={<SearchIcon />}
                loading={searching}
                disabled={searchText.trim() === ''}
                onClick={() => void runSearch()}
              >
                搜索
              </Button>
            </div>
          </div>

          {searchError === '' ? null : <div className="tencent-address-picker__search-error" role="status">{searchError}</div>}
          {searchResults.length === 0 ? null : (
            <ul className="tencent-address-picker__results" aria-label="腾讯地图地址搜索结果">
              {searchResults.map((candidate) => (
                <li key={candidate.id}>
                  <Button variant="text" tag="button" type="button" onClick={() => void chooseCandidate(candidate)}>
                    <strong>{candidate.title}</strong>
                    <span>{candidate.fullAddress}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div
            ref={mapContainerRef}
            className="tencent-address-picker__map"
            tabIndex={0}
            aria-label="腾讯地图。鼠标点击可选择坐标；键盘用户请使用上方地址搜索。"
          />
          <p className="tencent-address-picker__selection" aria-live="polite">{selectionMessage}</p>
        </>
      ) : null}
    </section>
  );
}
