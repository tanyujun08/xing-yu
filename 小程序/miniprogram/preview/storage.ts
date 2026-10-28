// Local demo storage is isolated from the real app and other demo copies.
const prefix = 'xingyu.offline-v102.';
export const demoStorage: Pick<typeof wx, 'getStorageSync' | 'setStorageSync' | 'removeStorageSync' | 'getStorageInfoSync'> = {
 getStorageSync(key) { return wx.getStorageSync(prefix + key); },
 setStorageSync(key, data) { wx.setStorageSync(prefix + key, data); },
 removeStorageSync(key) { wx.removeStorageSync(prefix + key); },
 getStorageInfoSync() { const info = wx.getStorageInfoSync(); return { ...info, keys: info.keys.filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length)) }; },
};
