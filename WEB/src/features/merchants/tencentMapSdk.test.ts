// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';
import { composeFullAddress } from './addressProjection';
import { normalizeTencentSuggestionResponse } from './tencentAddressProjection';
import {
  buildTencentMapSdkUrl,
  describeTencentServiceError,
  loadTencentMapSdk,
  withTencentServiceTimeout,
} from './tencentMapSdk';

afterEach(() => {
  vi.useRealTimers();
});

describe('Tencent map SDK boundary', () => {
  test('builds the approved HTTPS SDK URL with service library and async callback', () => {
    const url = new URL(buildTencentMapSdkUrl('example-public-key'));

    expect(url.origin).toBe('https://map.qq.com');
    expect(url.pathname).toBe('/api/gljs');
    expect(url.searchParams.get('v')).toBe('1');
    expect(url.searchParams.get('key')).toBe('example-public-key');
    expect(url.searchParams.get('libraries')).toBe('service');
    expect(url.searchParams.get('callback')).toBe('__xyTencentMapReady');
  });

  test('fails closed without a key and does not append a remote script', async () => {
    const before = document.querySelectorAll('script[data-xy-tencent-map-sdk]').length;

    await expect(loadTencentMapSdk('   ')).rejects.toThrow('未配置腾讯地图 Key');

    expect(document.querySelectorAll('script[data-xy-tencent-map-sdk]')).toHaveLength(before);
  });

  test('fails closed when a Tencent service request never settles', async () => {
    vi.useFakeTimers();
    const request = withTencentServiceTimeout(
      new Promise<never>(() => undefined),
      '坐标解析超时，请检查 Key 权限、域名白名单或网络',
      50,
    );
    const assertion = expect(request).rejects.toThrow('坐标解析超时');

    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });

  test('surfaces a bounded Tencent service message without relying on Error instances', () => {
    expect(describeTencentServiceError(
      { status: 121, message: '此key每日调用量已达到上限' },
      '地址搜索失败',
    )).toBe('地址搜索失败：此key每日调用量已达到上限');
    expect(describeTencentServiceError({ status: 500 }, '地址搜索失败')).toBe('地址搜索失败');
  });

  test('normalizes the official SuggestionResult shape with LatLng getters and root region fields', () => {
    const rows = normalizeTencentSuggestionResponse({
      status: 0,
      data: [{
        id: 'poi-1',
        title: '会展湾中港广场',
        address: '宝安区福海街道展城路 1 号',
        province: '广东省',
        city: '深圳市',
        location: {
          getLat: () => 22.7072,
          getLng: () => 113.8451,
        },
      }],
    });

    expect(rows).toEqual([expect.objectContaining({
      id: 'poi-1',
      province: '广东省',
      city: '深圳市',
      district: '宝安区',
      latitude: 22.7072,
      longitude: 113.8451,
      fullAddress: '广东省深圳市宝安区福海街道展城路 1 号',
    })]);
  });
});

describe('operating address projection', () => {
  test('does not duplicate municipality names', () => {
    expect(composeFullAddress({
      province: '北京市',
      city: '北京市',
      district: '海淀区',
      detailAddress: '中关村大街 1 号',
    })).toBe('北京市海淀区中关村大街 1 号');
  });

  test('keeps a full detail address instead of prefixing it again', () => {
    expect(composeFullAddress({
      province: '广东省',
      city: '深圳市',
      district: '宝安区',
      detailAddress: '广东省深圳市宝安区福海街道 100 号',
    })).toBe('广东省深圳市宝安区福海街道 100 号');
  });

  test('adds only the missing province when detail starts with the city', () => {
    expect(composeFullAddress({
      province: '广东省',
      city: '深圳市',
      district: '宝安区',
      detailAddress: '深圳市宝安区福海街道 100 号',
    })).toBe('广东省深圳市宝安区福海街道 100 号');
  });
});
