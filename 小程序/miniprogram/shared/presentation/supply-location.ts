import { demoWx } from '../../preview/platform';
/** Native place viewer. Coordinates must be supplied in GCJ-02; never infer them from an address. */
export interface SupplyLocation {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export function openSupplyLocation(location: SupplyLocation): void {
  const { latitude, longitude } = location;
  if (typeof latitude !== 'number' || typeof longitude !== 'number'
    || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    wx.showModal({
      title: '在地图确认地点',
      content: location.name + '\n' + location.address + '\n将复制地址，请在地图搜索并确认目的地。',
      confirmText: '选择地点',
      success: ({ confirm }) => {
        if (!confirm) return;
        const choose = () => demoWx.chooseLocation({
          success: (selected) => openSupplyLocation(selected),
          fail: (error) => {
            if (error.errMsg.includes('cancel')) return;
            wx.showModal({ title: '暂时无法选择地点', content: '地图权限未开启或暂不可用。可复制地址到微信地图搜索：\n' + location.address, showCancel: false });
          },
        });
        wx.setClipboardData({ data: location.address, success: () => { choose(); }, fail: () => { choose(); } });
      },
    });
    return;
  }
  demoWx.openLocation({
    latitude, longitude, name: location.name, address: location.address, scale: 16,
    fail: () => { wx.showToast({ title: '地图暂时无法打开', icon: 'none' }); },
  });
}
