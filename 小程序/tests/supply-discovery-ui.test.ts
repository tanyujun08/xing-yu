import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { styleValue } from './helpers/style-contract';

const root = process.cwd();
const miniprogramRoot = join(root, 'miniprogram');

function source(route: string, extension: 'ts' | 'wxml' | 'wxss' | 'json'): string {
  return readFileSync(join(miniprogramRoot, `${route}.${extension}`), 'utf8');
}

test('柜机列表按当前城市的柜机名称切换右侧内容', () => {
  const script = source('pages/cabinets/index', 'ts');
  const markup = source('pages/cabinets/index', 'wxml');
  const style = source('pages/cabinets/index', 'wxss');

  expect(script).toContain('selectedCabinetId');
  expect(script).toContain('activeCabinet');
  expect(script).toContain('selectCabinet');
  expect(script).not.toContain('regionShort');
  expect(script).not.toContain('selectRegion');
  expect(markup).toContain('wx:for="{{cabinets}}"');
  expect(markup).toContain('bindtap="selectCabinet"');
  expect(markup).toContain('class="cabinet-summary xy-tap" data-id="{{activeCabinet.id}}" bindtap="openCabinet"');
  expect(markup).toContain('{{activeCabinet.name}}');
  expect(markup).not.toContain('bindtap="selectRegion"');
  expect(markup).not.toContain('region-list');
  const railStyle = readFileSync(join(miniprogramRoot, 'shared/design/discovery-rail.wxss'), 'utf8');
  expect(style).toContain('discovery-rail.wxss');
  expect(styleValue(railStyle, '.cabinet-rail', 'width')).toBe(styleValue(railStyle, '.region-list', 'width'));
  expect(markup).toContain('wx:key="id"');
});

test('设备展示使用真实租赁模式、押金和服务端金额口径', () => {
  const projection = readFileSync(join(miniprogramRoot, 'shared/presentation/api-supply.ts'), 'utf8');
  expect(projection).toContain("homePriceUnit: item.rental_mode === 'HOUR' ? '/小时' : '/天'");
  // The store surfaces render the shared discovery template, so their device projection must
  // format minor units itself and must not carry a fixture device or a mock API.
  for (const route of ['pages/stores/index', 'pages/store-detail/index']) {
    const script = source(route, 'ts');
    expect(script).not.toContain('mockApi');
    expect(script).toContain('formatCNYMinorUnits');
    expect(script).toContain("supply.rental_mode === 'HOUR' ? '/小时' : '/天'");
    expect(script).toContain('publicSupplyGallery');
  }
  expect(source('pages/store-detail/index', 'ts')).not.toContain('designAssets.storeDetail2');
  expect(source('pages/store-detail/index', 'wxml')).toContain('wx:if="{{heroImages.length}}"');
  const cabinetDetail = source('pages/cabinet-detail/index', 'ts');
  expect(cabinetDetail).not.toContain('mockApi');
  expect(cabinetDetail).toContain('cabinet.supplies.map');
  expect(cabinetDetail).toContain('formatCNYMinorUnits');
  expect(cabinetDetail).toContain("supply.rental_mode === 'HOUR' ? '/小时' : '/天'");
  expect(cabinetDetail).toContain('publicSupplyGallery');
  expect(source('pages/stores/index', 'wxml')).not.toContain("deviceId === 'sony-200-600'");
  expect(source('pages/stores/index', 'wxml')).not.toContain('{{item.media}}');
});

test('设备详情使用现有真实素材轮播且最多展示九张', () => {
  const detailScript = source('pages/detail/index', 'ts');
  const detailMarkup = source('pages/detail/index', 'wxml');
  const projection = readFileSync(join(root, 'miniprogram/shared/presentation/api-supply.ts'), 'utf8');
  expect(projection).toContain('MAX_DETAIL_MEDIA = 9');
  expect(detailScript).not.toContain('detailMediaPool');
  expect(detailScript).not.toContain('mockApi');
  expect(detailScript).toContain('publicSupplyGallery(value)');
  expect(detailScript).not.toContain('download-authorizations');
  expect(projection).toContain('publicMediaGallery(supply.media,MAX_DETAIL_MEDIA)');
  expect(detailMarkup).toContain('wx:for="{{galleryItems}}"');
  expect(detailMarkup).toContain('galleryItems.length');
});

test('柜机和门店列表标题与当前供给入口保持一致', () => {
  expect(JSON.parse(source('pages/cabinets/index', 'json')).navigationBarTitleText).toBe('柜机列表');
  expect(JSON.parse(source('pages/stores/index', 'json')).navigationBarTitleText).toBe('门店列表');
  const storeMarkup = source('pages/stores/index', 'wxml');
  const storeStyle = source('pages/stores/index', 'wxss');
  expect(storeMarkup).toContain('class="store-more xy-tap" data-id="{{item.id}}" bindtap="openStore"');
  expect(storeMarkup).toContain('>查看更多<image');
  expect(storeMarkup).toContain('store-gallery');
  expect(storeMarkup).not.toContain('store-all-hit');
  expect(styleValue(storeStyle, '.store-more', 'display')).toBe('flex');
  expect(styleValue(storeStyle, '.store-more image', 'width')).toBe(styleValue(storeStyle, '.store-more image', 'height'));
  expect(storeStyle).not.toContain('.store-all-hit');
});

test('首页、柜机列表和门店列表地区箭头统一向下', () => {
  expect(source('pages/home/index', 'wxml')).toContain('src="{{icons.homeChevronDown}}"');
  expect(source('pages/home/index', 'wxss')).not.toMatch(/\.location-chevron[^}]*transform:/s);
  expect(source('pages/cabinets/index', 'wxss')).not.toMatch(/\.location-caret[^}]*transform:/s);
  expect(source('pages/stores/index', 'wxss')).not.toMatch(/\.location-caret[^}]*transform:/s);
  expect(source('pages/cabinets/index', 'wxss')).not.toContain('transform: rotate(270deg);');
  expect(source('pages/stores/index', 'wxss')).not.toContain('transform: rotate(270deg);');
});

test('实体轮播保持实际计数，设备名称金额与说明按当前共享模板关联', () => {
  const template = readFileSync(join(miniprogramRoot, 'shared/design/discovery-device.wxml'), 'utf8');
  const shared = readFileSync(join(miniprogramRoot, 'shared/design/components.wxss'), 'utf8');
  for (const page of ['cabinet-detail', 'store-detail']) {
    expect(source(`pages/${page}/index`, 'wxml')).toContain('wx:for="{{heroImages}}" wx:key="id"');
    expect(source(`pages/${page}/index`, 'wxml')).toContain('{{heroCurrent + 1}}/{{heroImages.length}}');
    expect(source(`pages/${page}/index`, 'wxml')).toContain('bindchange="onHeroChange"');
  }
  expect(template).toContain('class="xy-discovery-device__copy"');
  expect(template).toContain('{{device.priceValue}}');
  expect(template).toContain('{{device.depositValue}}');
  expect(template).toContain('device.displayDescription');
  expect(styleValue(shared, '.xy-discovery-device__copy', 'min-width')).toBe('0');
  expect(styleValue(shared, '.xy-discovery-info', 'column-gap')).toBe('16px');
  expect(styleValue(shared, '.xy-discovery-band', 'height')).toBe('8px');
});
