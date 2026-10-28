import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { OperatingAddress } from '../../shared/services';
import type { TencentLatLng, TencentMapClickEvent, TencentMarkerGeometry } from './tencentMapSdk';
import { loadTencentMapSdk } from './tencentMapSdk';
import { TencentAddressPicker } from './TencentAddressPicker';

const mapHarness = vi.hoisted(() => ({
  clickListener: undefined as ((event: TencentMapClickEvent) => void) | undefined,
  getAddress: vi.fn<() => Promise<unknown>>(),
  getSuggestions: vi.fn<() => Promise<unknown>>(),
  setCenter: vi.fn<(center: TencentLatLng) => void>(),
  setGeometries: vi.fn<(geometries: readonly TencentMarkerGeometry[]) => void>(),
}));

vi.mock('./tencentMapSdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./tencentMapSdk')>();

  class MockLatLng implements TencentLatLng {
    constructor(readonly lat: number, readonly lng: number) {}
    getLat() { return this.lat; }
    getLng() { return this.lng; }
  }

  const sdk = {
    LatLng: MockLatLng,
    Map: class {
      on(_eventName: 'click', listener: (event: TencentMapClickEvent) => void) {
        mapHarness.clickListener = listener;
      }
      off() { mapHarness.clickListener = undefined; }
      setCenter(center: TencentLatLng) { mapHarness.setCenter(center); }
      destroy() { return undefined; }
    },
    MultiMarker: class {
      setGeometries(geometries: readonly TencentMarkerGeometry[]) { mapHarness.setGeometries(geometries); }
      setMap() { return undefined; }
    },
    service: {
      Suggestion: class {
        getSuggestions() { return mapHarness.getSuggestions(); }
      },
      Geocoder: class {
        getAddress() { return mapHarness.getAddress(); }
      },
    },
  };

  return {
    ...actual,
    loadTencentMapSdk: vi.fn(() => Promise.resolve(sdk)),
  };
});

vi.mock('../../shared/config/env', () => ({
  publicEnv: Object.freeze({ apiBaseURL: '', tencentMapKey: 'test-only-map-key' }),
}));

const originalAddress: OperatingAddress = {
  provinceCode: '440000',
  cityCode: '440300',
  districtCode: '440306',
  province: '广东省',
  city: '深圳市',
  district: '宝安区',
  poiName: '星遇合作影像空间',
  detailAddress: '演示路 100 号',
  fullAddress: '广东省深圳市宝安区演示路 100 号',
  longitude: 113.8451,
  latitude: 22.7072,
  confirmationStatus: 'TENCENT_CONFIRMED',
};

afterEach(cleanup);

beforeEach(() => {
  mapHarness.clickListener = undefined;
  mapHarness.getAddress.mockReset();
  mapHarness.getSuggestions.mockReset().mockResolvedValue({ data: [] });
  mapHarness.setCenter.mockReset();
  mapHarness.setGeometries.mockReset();
});

describe('TencentAddressPicker map click transaction', () => {
  test('never offers manual coordinate entry as a map failure fallback', async () => {
    vi.mocked(loadTencentMapSdk).mockRejectedValueOnce(new Error('map unavailable'));
    render(<TencentAddressPicker value={originalAddress} onChange={vi.fn()} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('map unavailable');
    expect(alert.textContent).not.toMatch(/手工|经纬度输入/);
  });

  test('keeps the complete controlled address unchanged when reverse geocoding fails', async () => {
    mapHarness.getAddress.mockRejectedValueOnce(new Error('network unavailable'));
    const onChange = vi.fn();
    render(<TencentAddressPicker value={originalAddress} onChange={onChange} />);

    await screen.findByText('地图已连接');
    expect(screen.queryByRole('button', { name: '加载腾讯地图' })).toBeNull();
    await waitFor(() => expect(mapHarness.clickListener).toBeTypeOf('function'));

    act(() => mapHarness.clickListener?.({ latLng: { lat: 22.7088, lng: 113.8466 } }));

    await screen.findByText(/本次地图坐标未保存/);
    expect(onChange).not.toHaveBeenCalled();
    expect(originalAddress).toMatchObject({
      fullAddress: '广东省深圳市宝安区演示路 100 号',
      longitude: 113.8451,
      latitude: 22.7072,
      confirmationStatus: 'TENCENT_CONFIRMED',
    });
    expect(mapHarness.setGeometries).toHaveBeenLastCalledWith([
      expect.objectContaining({
        id: 'operating-address',
        position: expect.objectContaining({ lat: 22.7072, lng: 113.8451 }),
      }),
    ]);
  });
});

const reverseResult = { result: { address: '广东省深圳市福田区公共路', address_component: { province: '广东省', city: '深圳市', district: '福田区', street: '公共路' }, ad_info: { adcode: '440304' } } };
test('does not claim success when parent rejects region resolution', async () => {
  mapHarness.getAddress.mockResolvedValue(reverseResult);
  const onChange = vi.fn().mockRejectedValue(new Error('当前生效区划无法唯一匹配'));
  render(<TencentAddressPicker value={originalAddress} onChange={onChange} />);
  await waitFor(() => expect(mapHarness.clickListener).toBeTypeOf('function'));
  act(() => mapHarness.clickListener?.({ latLng: { lat: 22.55, lng: 114.1 } }));
  await screen.findByText(/当前生效区划无法唯一匹配.*未保存/);
  expect(screen.queryByText('已根据地图坐标回填经营地址')).toBeNull();
});
test('new click cancels parent resolution and unrelated rerender does not', async () => {
  mapHarness.getAddress.mockResolvedValue(reverseResult);
  let release: (() => void) | undefined;
  const onChange = vi.fn<(address: OperatingAddress, signal: AbortSignal) => Promise<void>>(() => new Promise<void>((resolve) => { release = resolve; }));
  const { rerender, unmount } = render(<TencentAddressPicker value={originalAddress} onChange={onChange} />);
  await waitFor(() => expect(mapHarness.clickListener).toBeTypeOf('function'));
  act(() => mapHarness.clickListener?.({ latLng: { lat: 22.55, lng: 114.1 } }));
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  const first = onChange.mock.calls[0]![1];
  rerender(<TencentAddressPicker value={{ ...originalAddress }} onChange={onChange} />);
  expect(first.aborted).toBe(false);
  act(() => mapHarness.clickListener?.({ latLng: { lat: 22.56, lng: 114.2 } }));
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
  expect(first.aborted).toBe(true);
  const second = onChange.mock.calls[1]![1];
  unmount();expect(second.aborted).toBe(true);
  await act(async () => { release?.(); });
});
test('manual address edit cancels late reverse response before parent mutation', async () => {
 let resolveReverse: ((value: unknown) => void) | undefined;
 mapHarness.getAddress.mockImplementation(() => new Promise((resolve) => { resolveReverse = resolve; }));
 const onChange = vi.fn();
 const { rerender } = render(<TencentAddressPicker value={originalAddress} onChange={onChange} />);
 await waitFor(() => expect(mapHarness.clickListener).toBeTypeOf('function'));
 act(() => mapHarness.clickListener?.({ latLng: { lat: 22.55, lng: 114.1 } }));
 rerender(<TencentAddressPicker value={{ ...originalAddress, detailAddress: '手动修改' }} onChange={onChange} />);
 await act(async () => { resolveReverse?.(reverseResult); });
 expect(onChange).not.toHaveBeenCalled();
});

test('search candidate waits for reverse lookup and parent acceptance before confirming', async () => {
 mapHarness.getSuggestions.mockResolvedValue({ data: [{ id: 'poi', title: '公共场所', province: '广东省', city: '深圳市', district: '福田区', address: '公共路', location: { lat: 22.5, lng: 114.1 } }] });
 let resolveReverse: ((value: unknown) => void) | undefined;
 mapHarness.getAddress.mockImplementation(() => new Promise((resolve) => { resolveReverse = resolve; }));
 const onChange = vi.fn().mockResolvedValue(undefined);
 render(<TencentAddressPicker value={originalAddress} onChange={onChange} />);
 await screen.findByText('地图已连接');
 fireEvent.change(screen.getByPlaceholderText('输入道路、门牌或场所名称'), { target: { value: '公共场所' } });
 fireEvent.click(screen.getByRole('button', { name: '搜索' }));
 fireEvent.click(await screen.findByRole('button', { name: /公共场所.*公共路/ }));
 expect(onChange).not.toHaveBeenCalled();
 await act(async () => { resolveReverse?.(reverseResult); });
 await screen.findByText(/已回填：/);
 expect(onChange).toHaveBeenCalledTimes(1);
 expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ districtCode: '440304', confirmationStatus: 'TENCENT_CONFIRMED' }), expect.any(AbortSignal));
});
