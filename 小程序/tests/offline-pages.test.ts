/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, expect, test, vi } from 'vitest';
import { entries } from '../miniprogram/preview/entries';
import { resetDemo, readDemo } from '../miniprogram/preview/engine';
import { installDemoPlatform } from '../miniprogram/preview/platform';
type Row = Record<string, any>;
let definition: Row;
const storage = new Map<string, unknown>();
const metrics = { windowWidth: 390, windowHeight: 844, screenWidth: 390, screenHeight: 844, statusBarHeight: 44, safeArea: { top: 44, bottom: 810, left: 0, right: 390, width: 390, height: 766 }, pixelRatio: 2, platform: 'devtools', fontSizeSetting: 16 };
beforeEach(() => {
 vi.useFakeTimers(); storage.clear(); definition = {};
 vi.stubGlobal('Page', (v: Row) => { definition = v; });
 const noOp = vi.fn();
 const api: Row = { getStorageSync: (k: string) => storage.get(k) ?? '', setStorageSync: (k: string, v: unknown) => storage.set(k, structuredClone(v)), removeStorageSync: (k: string) => storage.delete(k), getStorageInfoSync: () => ({ keys: [...storage.keys()] }), getSystemInfoSync: () => metrics, getWindowInfo: () => metrics, getDeviceInfo: () => metrics, getAppBaseInfo: () => metrics, getMenuButtonBoundingClientRect: () => ({ top: 48, height: 32, width: 87, left: 290, right: 377, bottom: 80 }), getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }), getFileSystemManager: () => ({ copyFile: noOp }), env: { USER_DATA_PATH: 'wxfile://usr' }, chooseMedia: noOp, createVideoContext: () => ({ stop() {} }), createSelectorQuery: () => { const q: Row = { in: () => q, select: () => q, selectAll: () => q, boundingClientRect: () => q, fields: () => q, exec: (f: any) => f?.([{ width: 390, height: 120 }]) }; return q; } };
 vi.stubGlobal('wx', new Proxy(api, { get(o, k) { return o[String(k)] ?? noOp; } }));
 vi.stubGlobal('getCurrentPages', () => []); vi.stubGlobal('getApp', () => ({ globalData: { version: '1.0.1.9' } }));
 resetDemo(); readDemo().latency = 0; installDemoPlatform();
});
for (const entry of entries.filter(v => !v.key.startsWith('order-state-'))) test('original page loads with data: ' + entry.key, async () => {
 vi.resetModules();
 // New module memory reads this same test storage namespace; seed once in the platform bootstrap.
 await import('../miniprogram/pages/' + entry.key + '/index.ts');
 const data = structuredClone(definition.data ?? {}), page: Row = { ...definition, data, route: entry.url.split('?')[0]!.slice(1), options: {}, getTabBar: () => ({ setData() {} }), selectComponent: () => ({ open() {}, setData() {}, reset() {}, triggerEvent() {} }), setData(patch: Row) { for (const [key, value] of Object.entries(patch)) { const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.'); let target = this.data; for (let i = 0; i < parts.length - 1; i++) { const k = parts[i]!; target[k] ??= /^\d+$/.test(parts[i + 1]!) ? [] : {}; target = target[k]; } target[parts[parts.length - 1]!] = value; } } };
 const query = Object.fromEntries((entry.url.split('?')[1] ?? '').split('&').filter(Boolean).map(part => { const [k = '', v = ''] = part.split('='); return [k, decodeURIComponent(v)]; })); page.options = query;
 if (entry.key === 'contract-sign') { const signature = await import('../miniprogram/shared/api/rental-contract-signature'); const engine = await import('../miniprogram/preview/engine'); signature.rentalSignatureDrafts.agree('order-1', engine.handleDemo('GET', '/v1/me/rental-orders/order-1/contract').data as never); }
 const load = page.onLoad?.(query); await vi.advanceTimersByTimeAsync(500); await load;
 const show = page.onShow?.(); await vi.advanceTimersByTimeAsync(1000); await show;
 expect(page.data.error ?? '').toBe('');
 expect(page.data.errorText ?? '', entry.key + ': ' + page.data.errorText).toBe('');
 if (entry.key === 'home') expect(page.data.visibleDevices.length).toBeGreaterThan(0);
 if (entry.key === 'orders') expect(JSON.stringify(page.data)).toContain('RO-DEMO');
 if (entry.key === 'profile') {expect(page.data.localProfile.name).toContain('演示');expect(page.data.identityText).toBe('实名认证已完成');expect(page.data.rentalSummary.deviceName).toBeTruthy();expect(page.data.lendStatus.listingStatus).not.toBe('暂未接入');expect(page.data.lendStatus.lendOrderStatus).not.toBe('暂未接入');}
 if (entry.key === 'publish') expect(page.data.hasDraftTarget).toBe(true);
 if (entry.key === 'contract') expect(page.data.canSign).toBe(true);
 if (entry.key === 'order-detail') expect(page.data.returnLanding).toBe(true);
 if (entry.key === 'account-security') expect(page.data.phoneActionEnabled).toBe(true);
 page.onHide?.(); page.onUnload?.(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});
