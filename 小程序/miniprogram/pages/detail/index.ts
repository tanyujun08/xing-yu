import { designAssets } from '../../shared/design/assets';
import { readDisplayWindowMetrics } from '../../shared/presentation/window-metrics';
import { supplyApi, type RentalSupply } from '../../shared/api/supply-api';
import { discoveryApi, type DiscoverySupply } from '../../shared/api/supply-api';
import { accountApi } from '../../shared/api/account-api';
import { supplyCard, deliveryLabels, publicSupplyGallery, publicSupplyVideo } from '../../shared/presentation/api-supply';
import { formatCNYMinorUnits } from '../../shared/format/money';
import { beijingTime } from '../../shared/presentation/rental-order';
import { createNavigateOnce } from '../../shared/interaction/navigate-once';
import { openLoginLegal, runLoginSheet } from '../../shared/interaction/login-sheet-host';
const states = new WeakMap<object, { id: string; owner: string; epoch: number; visible: boolean; pendingBuy?: boolean; active?: { abort: () => void }; videoRequest?: { abort: () => void }; entry?: RentalSupply|DiscoverySupply; navigation: ReturnType<typeof createNavigateOnce> }>();
function state(page: object) { let s = states.get(page); if (!s) { s = { id: '', owner: '', epoch: 0, visible: true, navigation: createNavigateOnce() }; states.set(page, s); } return s; }
const emptyDevice = { id: '', name: '', model: '', rentalMode: '', supplyType: '', description: '', location: '', address: '', deposit: '' };
Page({
  data: { icons: designAssets, device: emptyDevice, loading: false, errorText: '', loaded: false, loggedIn: false, rentText: '', depositText: '', rentCapText: '', galleryItems: [] as { src: string }[], galleryCurrent: 0, videoMediaIds: [] as string[], videoButtons: [] as { materialId: string }[], videoState: null as { materialId: string; src: string;poster:string } | null, videoBusy: false, videoViewEpoch: 0, videoErrorText: '', stackedInfo: false, showModel: false, attributeFacts: '', lessorName: '个人出租', equipmentRows: [] as { label: string; value: string }[], pickupMethods: [] as { id: string; label: string }[], returnMethods: [] as { id: string; label: string }[], manageMode: false, managementStatusText: '', showSupportFab: false, canQuote: false, personalDisplayOnly: false, quoteBlockedText: '' },
  onLoad(query: Record<string, string | undefined>) { const s = state(this); s.id = query['id'] ?? ''; if (query['listingId'] || query['mode'] === 'manage') s.id = ''; this.syncLayout(); },
  syncLayout() { const m = readDisplayWindowMetrics(); this.setData({ stackedInfo: m.windowWidth <= 360 || (m.fontSizeSetting || 16) > 16 }); },
  onResize() { this.syncLayout(); },
  onShow() { state(this).visible = true; void this.refreshSupply(); },
  onHide() { const s = state(this); s.visible = false; ++s.epoch; s.active?.abort(); s.videoRequest?.abort(); delete s.entry; if (this.data.videoState && typeof wx.createVideoContext === 'function') wx.createVideoContext('detail-original-video', this).stop(); this.setData({ device: emptyDevice, loaded: false, loading: false, galleryItems: [], videoMediaIds: [], videoButtons: [], videoState: null, videoBusy: false, videoErrorText: '', equipmentRows: [], pickupMethods: [], returnMethods: [], rentText: '', depositText: '', rentCapText: '', canQuote: false, personalDisplayOnly: false, quoteBlockedText: '' }); },
  onUnload() { this.onHide(); state(this).navigation.dispose(); states.delete(this); },
  async refreshSupply() {
    const s = state(this); s.active?.abort(); s.videoRequest?.abort(); const epoch = ++s.epoch; delete s.entry; s.owner = accountApi.sessionIdentity() ?? '';
    if (this.data.videoState && typeof wx.createVideoContext === 'function') wx.createVideoContext('detail-original-video', this).stop();
    this.setData({ loaded: false, loading: false, canQuote: false, personalDisplayOnly: false, quoteBlockedText: '', device: emptyDevice, rentText: '', depositText: '', galleryItems: [], videoMediaIds: [], videoButtons: [], videoState: null, videoBusy: false, videoErrorText: '', equipmentRows: [], loggedIn: !!s.owner, errorText: '' });
    if (!s.id || s.id.length > 64) { this.setData({ errorText: '未提供可查询的已上架设备。' }); return; }
    if (!s.owner) { await this.loadGuestSupply(epoch); return; }
    const owner = s.owner, handle = supplyApi.get(s.id); s.active = handle; this.setData({ loading: true });
    try { const value = await handle.promise; if (!s.visible || epoch !== s.epoch) return; if ((accountApi.sessionIdentity() ?? '') !== owner) { this.setData({ loggedIn: false, errorText: '登录状态已变化，请重新读取。' }); return; }
      const card = supplyCard(value), methods = value.delivery_methods.map(id => ({ id, label: deliveryLabels[id] ?? id }));
      const action = value.allowed_actions.find(item => item.code === 'QUOTE'); s.entry = value;
      const quoteBlockedText = action?.enabled === false ? '当前设备暂不能租赁，请刷新或联系客服' : '';
      const videoMediaIds = [...new Set(value.media.filter(item => item.role === 'VIDEO').map(item => item.material_id))];
      this.setData({ loaded: true, galleryItems: publicSupplyGallery(value), videoMediaIds, videoButtons: videoMediaIds.map(materialId => ({ materialId })), device: { id: value.asset_id, name: value.display_name, model: '', rentalMode: value.rental_mode === 'HOUR' ? 'hourly' : 'daily', supplyType: value.supply_type.toLowerCase(), description: value.description, location: value.pickup_location?.name ?? card.location, address: value.pickup_location ? [value.pickup_location.address.province_name, value.pickup_location.address.city_name, value.pickup_location.address.district_name, value.pickup_location.address.detail_address].filter(Boolean).join('') : card.location, deposit: card.deposit }, rentText: card.homePrice, depositText: card.deposit, rentCapText: formatCNYMinorUnits(value.reference_value_fen).slice(1), canQuote: (value.supply_type === 'PERSONAL' || value.supply_type === 'CABINET') && action?.enabled === true, personalDisplayOnly:false, quoteBlockedText,
        equipmentRows: [{ label: '成色', value: value.condition }, { label: '随附配件', value: value.accessories_text }, { label: '已知瑕疵', value: value.defect_description }, { label: '可租时间', value: beijingTime(value.available_from) + ' 至 ' + beijingTime(value.available_until) }].filter(item => !!item.value), pickupMethods: methods, returnMethods: methods });
    } catch (error) { if (s.visible && epoch === s.epoch) this.setData({ errorText: error instanceof Error ? error.message : '设备读取失败，请刷新。', loggedIn: (accountApi.sessionIdentity() ?? '') === owner }); }
    finally { if (s.visible && epoch === s.epoch) this.setData({ loading: false }); }
  },
  async loadGuestSupply(epoch: number) {
    const s = state(this), handle = discoveryApi.getSupply(s.id); s.active = handle;
    this.setData({ loading: true });
    try {
      const value = await handle.promise;
      if (!s.visible || epoch !== s.epoch || accountApi.sessionIdentity()) return;
      const card = supplyCard(value);
      s.entry=value;const galleryItems=publicSupplyGallery(value);const videoMediaIds=value.media.filter(media=>media.role==='VIDEO').map(media=>media.material_id);
      this.setData({ loaded: true, galleryItems, videoMediaIds, videoButtons:videoMediaIds.map(materialId=>({materialId})),
        device: { id: value.asset_id, name: value.display_name, model: '', rentalMode: value.rental_mode === 'HOUR' ? 'hourly' : 'daily', supplyType: value.supply_type.toLowerCase(), description: value.description, location: card.location, address: card.location, deposit: card.deposit },
        rentText: card.homePrice, depositText: card.deposit, rentCapText: '',
        canQuote: (value.supply_type === 'PERSONAL' || value.supply_type === 'CABINET') && value.availability_status === 'AVAILABLE', personalDisplayOnly:false, quoteBlockedText:'',
        equipmentRows: [{ label: '成色', value: value.condition }].filter(item => !!item.value),
        pickupMethods: [], returnMethods: [] });
    } catch (error) {
      if (s.visible && epoch === s.epoch) this.setData({ errorText: error instanceof Error ? error.message : '设备读取失败，请刷新。' });
    } finally {
      if (s.visible && epoch === s.epoch) this.setData({ loading: false });
    }
  },
  openLogin() { (this.selectComponent('#login-sheet') as unknown as { open(): void } | null)?.open(); },
  isLoginHostActive() { return states.has(this) && state(this).visible; },
  onWechatLogin() { void runLoginSheet(this, () => accountApi.login(), () => this.onLoginSuccess()); },
  onPhoneLogin(event: WechatMiniprogram.CustomEvent<{ phoneCode: string }>) { void runLoginSheet(this, () => accountApi.phoneLogin(event.detail.phoneCode), () => this.onLoginSuccess()); },
  onLoginLegal(event: WechatMiniprogram.CustomEvent<{ legal: string }>) { openLoginLegal(event); },
  onLoginCancel() { delete state(this).pendingBuy; },
  async onLoginSuccess() {
    const s = state(this);
    const requestedBuy = s.pendingBuy === true;
    delete s.pendingBuy;
    await this.refreshSupply();
    if (requestedBuy && s.visible) {
      if (s.entry && this.data.canQuote && accountApi.sessionIdentity() === s.owner) this.buy();
      else wx.showToast({ title: this.data.quoteBlockedText || '设备状态已变化，请重新查看', icon: 'none' });
    }
  },
  buy() { const s = state(this); if (this.data.quoteBlockedText) { wx.showToast({ title: this.data.quoteBlockedText, icon: 'none' }); return; } if (!s.visible || (accountApi.sessionIdentity() ?? '') !== s.owner || !this.data.canQuote) { wx.showToast({ title: '当前设备暂不能申请报价，请刷新。', icon: 'none' }); return; } if (!s.owner) { s.pendingBuy = true; this.openLogin(); return; } if (!s.entry || (s.entry.supply_type !== 'PERSONAL' && s.entry.supply_type !== 'CABINET')) { wx.showToast({ title: '请重新读取设备资料。', icon: 'none' }); return; } s.navigation.navigateOnce('confirm', callbacks => wx.navigateTo({ url: '/pages/confirm/index?deviceId=' + encodeURIComponent(s.entry!.asset_id), ...callbacks })); },
  onGalleryChange(event: WechatMiniprogram.SwiperChange) { this.setData({ galleryCurrent: event.detail.current }); },
  async playVideo(event: WechatMiniprogram.TouchEvent) {
    const s = state(this), materialId = event.currentTarget.dataset['id'];
    if (!s.visible || !s.entry || typeof materialId !== 'string' || !this.data.videoMediaIds.includes(materialId) || this.data.videoBusy || (accountApi.sessionIdentity() ?? '') !== s.owner) return;
    const epoch = s.epoch, supply = s.entry;
    if (this.data.videoState && typeof wx.createVideoContext === 'function') wx.createVideoContext('detail-original-video', this).stop();
    this.setData({ videoState: null, videoBusy: true, videoErrorText: '' });
    try {
      if (!s.visible || s.epoch !== epoch || (accountApi.sessionIdentity() ?? '') !== s.owner) return;
      const media=publicSupplyVideo(supply,materialId);if(!media)throw new Error('视频公开媒体不完整，请重新读取。');
      this.setData({ videoState: { materialId, src:media.url,poster:media.poster }, videoViewEpoch: epoch });
    } catch (error) {
      if (s.visible && s.epoch === epoch) this.setData({ videoErrorText: error instanceof Error ? error.message : '视频暂不可播放，请重试。' });
    } finally {
      if (s.visible && s.epoch === epoch) this.setData({ videoBusy: false });
    }
  },
  retryVideoPoster(event: WechatMiniprogram.CustomEvent) {
    const s = state(this), original = this.data.videoState, dataset = event.currentTarget.dataset;
    if (!s.visible || !s.entry || !original || this.data.videoBusy || (accountApi.sessionIdentity() ?? '') !== s.owner || Number(dataset['epoch']) !== s.epoch
      || dataset['id'] !== original.materialId || dataset['src'] !== original.src || dataset['poster'] !== original.poster) return;
    const owner = s.owner, epoch = s.epoch; const media = publicSupplyVideo(s.entry, original.materialId);
    if (!media || media.url !== original.src || media.poster !== original.poster) return;
    if (typeof wx.createVideoContext === 'function') wx.createVideoContext('detail-original-video', this).stop();
    this.setData({ videoState: null, videoBusy: true });
    wx.nextTick(() => {
      if (!s.visible || s.epoch !== epoch || !s.entry || (accountApi.sessionIdentity() ?? '') !== owner) return;
      const currentMedia = publicSupplyVideo(s.entry, original.materialId);
      if (!currentMedia || currentMedia.url !== original.src || currentMedia.poster !== original.poster) { this.setData({ videoBusy: false, videoErrorText: '视频媒体已变化，请重新读取设备资料。' }); return; }
      this.setData({ videoState: original, videoBusy: false, videoViewEpoch: epoch });
    });
  },
  onVideoError() { if (this.data.videoState && typeof wx.createVideoContext === 'function') wx.createVideoContext('detail-original-video', this).stop(); this.setData({ videoState: null, videoErrorText: '视频加载失败，请重新点击播放；将重载同一永久地址。' }); },
  onVideoTimeUpdate() { const s = state(this); if (this.data.videoState && (accountApi.sessionIdentity() ?? '') !== s.owner) { if (typeof wx.createVideoContext === 'function') wx.createVideoContext('detail-original-video', this).stop(); this.setData({ videoState: null, videoErrorText: '登录状态已变化，请重新读取设备资料。' }); } },

  editListing() { wx.showToast({ title: '本人发布管理正在接入', icon: 'none' }); },
  openNoDeposit() { state(this).navigation.navigateOnce('deposit', callbacks => wx.navigateTo({ url: '/pages/no-deposit/index', ...callbacks })); },
  openStores() {
    const s = state(this);
    if (!accountApi.sessionIdentity()) { this.openLogin(); return; }
    const pickup = s.entry && 'pickup_location' in s.entry ? s.entry.pickup_location : null;
    if (!s.visible || !this.data.loaded || !pickup?.cabinet_id) { wx.showToast({ title: '暂无可查看的租赁柜地点', icon: 'none' }); return; }
    s.navigation.navigateOnce('cabinet', callbacks => wx.navigateTo({ url: '/pages/cabinet-detail/index?id=' + encodeURIComponent(pickup.cabinet_id), ...callbacks }));
  },
  goBack() { wx.navigateBack(); },
demoSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
});
