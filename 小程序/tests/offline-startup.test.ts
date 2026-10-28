import { beforeEach, expect, test, vi } from 'vitest';
import { installDemoPlatform } from '../miniprogram/preview/platform';
import { dropDemoMemory, readDemo } from '../miniprogram/preview/engine';
const storage = new Map<string, unknown>();
const nativeRequest = vi.fn(), nativeLogin = vi.fn(), nativePayment = vi.fn(), nativeMedia = vi.fn();
beforeEach(() => { storage.clear(); dropDemoMemory(); vi.stubGlobal('wx', { request: nativeRequest, login: nativeLogin, requestPayment: nativePayment, chooseMedia: nativeMedia, getStorageSync: (key: string) => storage.get(key), setStorageSync: (key: string, value: unknown) => storage.set(key, value), getFileSystemManager: () => ({ writeFile: vi.fn() }), env: { USER_DATA_PATH: 'wxfile://usr' } }); });
test('offline startup preserves the native wx API identities used by DevTools hooks', () => { installDemoPlatform(); expect(wx.request).toBe(nativeRequest); expect(wx.login).toBe(nativeLogin); expect(wx.requestPayment).toBe(nativePayment); expect(wx.chooseMedia).toBe(nativeMedia); expect(readDemo().orders).toHaveLength(20); });
test('startup does not need to replace read-only SDK methods', () => { for (const key of ['request', 'login', 'requestPayment', 'chooseMedia']) Object.defineProperty(wx, key, { writable: false }); expect(() => installDemoPlatform()).not.toThrow(); });
