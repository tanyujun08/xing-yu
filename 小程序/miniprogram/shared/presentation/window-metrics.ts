export interface DisplayWindowMetrics { windowWidth: number; fontSizeSetting: number }

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Read on entry/resize; do not scale font values a second time. */
export function readDisplayWindowMetrics(): DisplayWindowMetrics {
  if (typeof wx === 'undefined') return { windowWidth: 430, fontSizeSetting: 16 };
  const legacy = typeof wx.getWindowInfo !== 'function' || typeof wx.getAppBaseInfo !== 'function'
    ? wx.getSystemInfoSync?.() : undefined;
  const windowInfo = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : legacy;
  const appInfo = typeof wx.getAppBaseInfo === 'function' ? wx.getAppBaseInfo() : legacy;
  return { windowWidth: positive(windowInfo?.windowWidth, 430), fontSizeSetting: positive(appInfo?.fontSizeSetting, 16) };
}
