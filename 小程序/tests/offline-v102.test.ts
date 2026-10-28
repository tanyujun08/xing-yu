import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { dropDemoMemory, handleDemo, readDemo } from '../miniprogram/preview/engine';
import { demoStorage } from '../miniprogram/preview/storage';
import { installDemoPlatform } from '../miniprogram/preview/platform';
import { cabinetApi } from '../miniprogram/shared/api/supply-api';

const storage = new Map<string, unknown>();
const nativeRequest = vi.fn(() => { throw new Error('Unexpected real request'); });
const nativePayment = vi.fn(() => { throw new Error('Unexpected real payment'); });
beforeEach(() => {
 storage.clear(); dropDemoMemory();
 vi.stubGlobal('wx', {
  request: nativeRequest, requestPayment: nativePayment,
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: unknown) => storage.set(key, structuredClone(value)),
  removeStorageSync: (key: string) => storage.delete(key),
  getStorageInfoSync: () => ({ keys: [...storage.keys()], currentSize: 0, limitSize: 10000 }),
  getFileSystemManager: () => ({ writeFile: vi.fn() }),
  getAccountInfoSync: () => ({ miniProgram: { appId: 'offline-test' } }),
  env: { USER_DATA_PATH: 'wxfile://usr' },
 });
 installDemoPlatform(); readDemo().latency = 0;
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

test('new replica leaves real and other demo account sessions untouched', () => {
 const legacy = { accountId: 'other-user', accessToken: 'old', refreshToken: 'old', expiresAt: 9999999999999 };
 storage.set('xingyu.api-session.v1', legacy); storage.set('xingyu.offline-demo.v1', { old: 'preserve' });
 demoStorage.setStorageSync('demo-test', 'isolated');
 expect(storage.get('xingyu.api-session.v1')).toEqual(legacy);
 expect(storage.get('xingyu.offline-demo.v1')).toEqual({ old: 'preserve' });
 expect(storage.get('xingyu.offline-v102.demo-test')).toBe('isolated');
 expect(demoStorage.getStorageInfoSync().keys.filter(k => k === 'xingyu.api-session.v1')).toHaveLength(1);
 expect(demoStorage.getStorageSync('xingyu.api-session.v1')).toMatchObject({ accountId: 'demo-tenant' });
 expect(wx.request).toBe(nativeRequest); expect(wx.requestPayment).toBe(nativePayment);
});
test('startup does not invoke legacy cache retirement', () => {
 const source = readFileSync(new URL('../miniprogram/app.ts', import.meta.url), 'utf8');
 expect(source).not.toContain('retireLegacyStorage');
 const app = JSON.parse(readFileSync(new URL('../miniprogram/app.json', import.meta.url), 'utf8'));
 expect(app.pages[0]).toBe('pages/home/index'); expect(app.pages).toContain('pages/demo-center/index');
});
test('v1.0.2.0 cabinet scene lookup passes original API validation with demo equipment and distinct images', async () => {
 const cabinet = await cabinetApi.byScene('cab_demo1234567890123456').promise;
 expect(cabinet.cabinet_id).toBe('cabinet-1'); expect(cabinet.supplies.length).toBeGreaterThan(0);
 const mediaId = cabinet.supplies[0]!.media[0]!.material_id;
 const material = handleDemo('GET', '/v1/materials/' + mediaId).data;
 expect(material.public_url).toMatch(/^\/assets\/demo\/device-\d\.png$/);
 expect(nativeRequest).not.toHaveBeenCalled();
});
test('new original cabinet page loads the scanned scene and shows local device covers', async () => {
 let definition: Record<string, unknown> = {};
 vi.stubGlobal('Page', (value: Record<string, unknown>) => { definition = value; });
 await import('../miniprogram/pages/cabinet-detail/index');
 const data = structuredClone(definition['data']) as Record<string, unknown>;
 const page = { ...definition, data, setData(patch: Record<string, unknown>) { Object.assign(data, patch); } };
 (definition['onLoad'] as (this: unknown, options: Record<string, string>) => void).call(page, { scene: 'cab_demo1234567890123456' });
 await vi.waitFor(() => expect((data['cabinet'] as { id: string }).id).toBe('cabinet-1'), { timeout: 3000 });
 await vi.waitFor(() => expect((data['devices'] as Array<{ displayImage: string }>)[0]?.displayImage).toMatch(/^\/assets\/demo\/device-\d\.png$/));
 expect(data['errorText']).toBe('');
});
test('unknown and malformed cabinet scenes are not silently converted to another cabinet', () => {
 expect(() => handleDemo('GET', '/v1/rental-cabinets/by-scene?scene=bad')).toThrow('格式无效');
 expect(() => handleDemo('GET', '/v1/rental-cabinets/by-scene?scene=cab_ABCDEFGHIJKLMNOPQRST')).toThrow('不存在');
 expect(() => handleDemo('GET', '/v1/rental-cabinets/cabinet-99')).toThrow('不存在');
 expect(handleDemo('GET', '/v1/rental-cabinets/by-scene?scene=cab_demo1234567890123457').data.cabinet_id).toBe('cabinet-2');
});
test('newer cabinet UI includes failed-confirmed recovery while support remains offline', () => {
 const wxml = readFileSync(new URL('../miniprogram/pages/cabinet-return/index.wxml', import.meta.url), 'utf8');
 expect(wxml).toContain("taskStatus === 'FAILED_CONFIRMED'"); expect(wxml).toContain('重新选择归还租赁柜');
 expect(wxml).toContain('bindtap="demoSupport"'); expect(wxml).not.toContain('open-type="contact"');
 const details = readFileSync(new URL('../miniprogram/pages/cabinet-detail/index.wxml', import.meta.url), 'utf8');
 expect(details).toContain('cabinet-device-media'); expect(details).toContain('柜机示意图'); expect(details).not.toMatch(/https?:\/\//);
});
test('unmapped routes fail locally without calling the real network', () => {
 expect(() => handleDemo('GET', '/v1/not-an-offline-route')).toThrow('尚未适配');
 expect(nativeRequest).not.toHaveBeenCalled();
});
test('cancelled unpaid sample orders never display payment, delivery, or return as completed', () => {
 const rows=readDemo().orders.filter(value=>value.order.stage==='CLOSED');expect(rows).toHaveLength(2);
 for(const value of rows){expect(value.order.initial_paid_fen).toBe('0');expect(value.bill.initial_payment.status).toBe('CLOSED_UNPAID');expect(value.bill.deposit_received_fen).toBe('0');expect(value.delivery.delivered_at).toBeNull();expect(value.return_id).toBeNull();}
});
