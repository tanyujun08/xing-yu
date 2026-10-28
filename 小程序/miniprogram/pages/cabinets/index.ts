import { designAssets } from '../../shared/design/assets';
import { readDisplayWindowMetrics } from '../../shared/presentation/window-metrics';
import { readDiscoveryCity, cabinetApi, type PublicCabinet, type RentalSupply } from '../../shared/api/supply-api';
import { publicSupplyGallery } from '../../shared/presentation/api-supply';
import { formatCNYMinorUnits } from '../../shared/format/money';
import { accountApi } from '../../shared/api/account-api';
import { rentalOrderApi, type RentalOrder, type RentalTask } from '../../shared/api/rental-api';
import { createReturnCabinetState, readReturnCabinetContext } from '../../shared/interaction/return-cabinet-context';
import { rentalBlockers } from '../../shared/presentation/rental-order';

type CabinetListView = {
  available?: boolean;
  id: string;
  name: string;
  address: string;
  media: string;
  devices: never[];
  deviceAvailabilityLabel: string;
  availabilityLabel: string;
  statusLabel: string;
  metaLabel: string;
};

const cabinetStates = new WeakMap<object, { epoch: number; visible: boolean; covers: Map<string, string> }>();
const returnStates = new WeakMap<object, ReturnType<typeof createReturnCabinetState<RentalOrder, RentalTask>>>();
function returnState(page: object) { let value = returnStates.get(page); if (!value) { value = createReturnCabinetState<RentalOrder, RentalTask>(); returnStates.set(page, value); } return value; }
function captureReturnView(state: ReturnType<typeof returnState>) {
  const epoch = state.epoch, sequence = state.readSequence;
  return () => state.visible && !state.scope.disposed && state.epoch === epoch && state.readSequence === sequence;
}
function captureReturnSessionLoss(state: ReturnType<typeof returnState>) {
  const epoch = state.epoch, owner = state.owner;
  return () => state.visible && !state.scope.disposed && state.epoch === epoch && state.owner === owner && (accountApi.sessionIdentity() ?? '') !== owner;
}

function cabinetState(page: object) {
  const current = cabinetStates.get(page);
  if (current) return current;
  const created = { epoch: 0, visible: true, covers: new Map<string, string>() };
  cabinetStates.set(page, created);
  return created;
}

// The public cabinet projection carries minor-unit strings, and the shared discovery template
// renders priceValue/depositValue verbatim, so they are formatted here. The contract exposes no
// compartment count or distance, so neither is invented: capacity comes from its own supplies.
function deviceView(supply: RentalSupply, coverUrl: string) {
  return {
    id: supply.asset_id,
    name: supply.display_name,
    displayImage: coverUrl,
    displayDescription: supply.description,
    displayTags: [] as string[],
    supplyType: supply.supply_type.toLowerCase(),
    location: [supply.region?.city_name, supply.region?.district_name].filter(Boolean).join(''),
    priceSymbol: '¥',
    priceValue: formatCNYMinorUnits(supply.unit_price_fen).slice(1),
    priceUnit: supply.rental_mode === 'HOUR' ? '/小时' : '/天',
    depositValue: formatCNYMinorUnits(supply.deposit_fen).slice(1),
    priceLabel: '',
    depositLabel: '',
    priceLine: '',
  };
}

function cabinetView(cabinet: PublicCabinet, coverMap: Map<string, string>): CabinetListView {
  const supplies = Array.isArray(cabinet.supplies) ? cabinet.supplies : [];
  return {
    id: cabinet.cabinet_id,
    name: cabinet.name,
    address: [cabinet.address?.city_name, cabinet.address?.district_name, cabinet.address?.detail_address].filter(Boolean).join(' '),
    media: designAssets.cabinetList,
    devices: supplies.map((supply) => deviceView(supply, coverMap.get(supply.asset_id) ?? '')) as never[],
    deviceAvailabilityLabel: `${supplies.length}台设备可租`,
    availabilityLabel: `${supplies.length}台设备`,
    statusLabel: '',
    metaLabel: cabinet.deployment_site_name ?? '',
  };
}

function cityName(value: string): string {
  const cityEnd = value.indexOf('市');
  return cityEnd >= 0 ? value.slice(0, cityEnd + 1) : value;
}

function selectedCabinetFor(cabinets: CabinetListView[], selectedId: string): CabinetListView | null {
  return cabinets.find((cabinet) => cabinet.id === selectedId) ?? cabinets[0] ?? null;
}

Page({
  refreshType() { this.setData({ largeType: readDisplayWindowMetrics().fontSizeSetting > 20 }); },
  onResize() { this.refreshType(); },
  onSecondaryNavigationBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) }); },
  data: {
    preCount: 0, returnLocation: '', visibleCabinets: [] as CabinetListView[],
    returnMode: false, canSelect: false, returnTaskId: '', returnTaskCabinetId: '', returnTaskReserved: false, optionsLoaded: false, cursor: null as string | null, returnCopy: '',
    icons: designAssets,
    largeType: readDisplayWindowMetrics().fontSizeSetting > 20,
    region: '',
    regionCity: '',
    cabinets: [] as CabinetListView[],
    selectedCabinetId: '',
    activeCabinet: null as CabinetListView | null,
    loading: false,
    errorText: '',
  },

  onLoad(options: Record<string, string | undefined>) {
    if (options['mode'] === 'return') { returnState(this).id = options['orderId'] ?? ''; this.setData({ returnMode: true }); }
  },

  clearUnavailableReturn() {
    const state = returnState(this); state.current = null; state.task = null;
    this.setData({ loading: false, canSelect: false, optionsLoaded: false, cabinets: [], visibleCabinets: [], returnLocation: '', activeCabinet: null, selectedCabinetId: '', cursor: null, returnTaskId: '', returnTaskCabinetId: '', returnTaskReserved: false, returnCopy: '', errorText: '登录状态已失效或变化，请重新登录后读取本人归还柜机' });
  },
  async refreshReturn(more = false) {
    const state = returnState(this), ownerActive = state.capture(accountApi.sessionIdentity), sequence = ++state.readSequence;
    const viewCurrent = captureReturnView(state), sessionLost = captureReturnSessionLoss(state), active = () => ownerActive() && sequence === state.readSequence;
    if (!active() || !state.owner) { if (viewCurrent()) this.clearUnavailableReturn(); return; }
    this.setData({ loading: true, errorText: '', canSelect: false, optionsLoaded: false, returnTaskId: '' });
    try {
      if (!state.id || !state.owner) throw new Error('请从本人官方订单进入归还选柜');
      const context = await readReturnCabinetContext(rentalOrderApi, state.id, active);
      if (!context || !active()) return;
      state.current = context.order; state.task = context.task;
      this.setData({ preCount: (context.order.value.requirements?.return_evidence_template?.slots ?? []).filter(v => v.stage === 'PRE_RETURN').reduce((n,v) => n + v.min_count,0), returnTaskId: context.task?.value.task_id ?? '', returnTaskCabinetId: context.task?.value.cabinet_id ?? '', returnTaskReserved: context.task?.value.status === 'RESERVED', returnCopy: rentalBlockers(context.order.value.order.blockers), cabinets: more ? this.data.cabinets : [], activeCabinet: more ? this.data.activeCabinet : null });
      if (!context.canSelect) return;
      const options = await rentalOrderApi.cabinets(state.id, more ? this.data.cursor ?? undefined : undefined).promise;
      if (!active()) return;
      const rows: CabinetListView[] = options.value.items.map(item => ({ available: item.compartments.some(slot => slot.available), id: item.cabinet_id, name: item.name, address: item.address?.trim() || '地址未提供', media: '', devices: [], deviceAvailabilityLabel: item.compartments.some(slot => slot.available) ? `${item.compartments.filter(slot => slot.available).length}个可用格口` : '暂无可用格口', availabilityLabel: '', statusLabel: item.connectivity_status, metaLabel: '' }));
      const cabinets = more ? [...this.data.cabinets, ...rows.filter(item => !this.data.cabinets.some(existing => existing.id === item.id))] : rows;
      this.setData({ cabinets, visibleCabinets: cabinets.filter(item => !this.data.returnLocation || item.address === this.data.returnLocation), activeCabinet: null, selectedCabinetId: '', canSelect: true, optionsLoaded: true, cursor: options.value.next_cursor, returnCopy: rentalBlockers(options.value.blockers) });
    } catch (error) { if (active()) this.setData({ errorText: error instanceof Error ? error.message : '归还柜机读取失败', cabinets: [], visibleCabinets: [], returnLocation: '', activeCabinet: null }); }
    finally { if (sessionLost()) this.clearUnavailableReturn(); else if (active()) this.setData({ loading: false }); }
  },
  async changeReturnLocation() { const s = returnState(this), active = s.capture(accountApi.sessionIdentity); if (!active() || !this.data.canSelect) return; const locations = [...new Set(this.data.cabinets.map(v => v.address))]; let offset = 0; try { while (active()) { const chunk = locations.slice(offset, offset + 4), hasMore = offset + chunk.length < locations.length; const choices = ['全部可归还位置', ...chunk, ...(hasMore ? ['更多位置'] : [])]; const answer = await wx.showActionSheet({ itemList: choices }); if (!active()) return; if (hasMore && answer.tapIndex === choices.length - 1) { offset += chunk.length; continue; } const location = answer.tapIndex ? chunk[answer.tapIndex - 1] ?? '' : ''; this.setData({ returnLocation: location, visibleCabinets: this.data.cabinets.filter(v => !location || v.address === location) }); return; } } catch { /* User cancelled position selection. */ } },
  showReturnAddress(event: WechatMiniprogram.TouchEvent) { if (!returnState(this).capture(accountApi.sessionIdentity)()) return; const row = this.data.cabinets.find(v => v.id === event.currentTarget.dataset['id']); if (row) void wx.showModal({ title: row.name, content: row.address, showCancel: false, confirmText: '知道了' }); },
  refreshOptions() { void returnState(this).run('return-cabinets-read', () => this.refreshReturn()); },
  loadMoreReturn() { if (this.data.cursor && !this.data.loading) void returnState(this).run('return-cabinets-read', () => this.refreshReturn(true)); },
  resumeReturnTask() {
    const state = returnState(this); if (!state.capture(accountApi.sessionIdentity)() || !this.data.returnTaskId) return;
    const url = this.data.returnTaskReserved ? '/pages/cabinet-detail/index?mode=return&orderId=' + encodeURIComponent(state.id) + '&id=' + encodeURIComponent(this.data.returnTaskCabinetId) : '/pages/cabinet-return/index?orderId=' + encodeURIComponent(state.id);
    state.navigation.navigateOnce('return-original-task', callbacks => wx.navigateTo({ url, ...callbacks }));
  },

  async loadCabinets() {
    const state = cabinetState(this);
    const epoch = ++state.epoch;
    const city = readDiscoveryCity();
    this.setData({ region: city?.name ?? '', regionCity: city?.name ? cityName(city.name) : '', loading: true, errorText: '' });
    try {
      const page = await cabinetApi.list(city ? { city_id: city.cityId } : {}).promise;
      if (!state.visible || epoch !== state.epoch) return;
      const items = (Array.isArray(page?.items) ? page.items : []).filter((cabinet) => !!cabinet && !!cabinet.cabinet_id && cabinet.status === 'ACTIVE');
      const cabinets = items.map((cabinet) => cabinetView(cabinet, state.covers));
      const activeCabinet = selectedCabinetFor(cabinets, String(this.data.selectedCabinetId ?? ''));
      this.setData({ cabinets, selectedCabinetId: activeCabinet?.id ?? '', activeCabinet });
      void this.loadSupplyCovers(items.flatMap((cabinet) => (Array.isArray(cabinet.supplies) ? cabinet.supplies : [])), items, epoch);
    } catch (error) {
      if (state.visible && epoch === state.epoch) this.setData({ cabinets: [], selectedCabinetId: '', activeCabinet: null, errorText: error instanceof Error ? error.message : '柜机读取失败，请重试。' });
    } finally {
      if (state.visible && epoch === state.epoch) this.setData({ loading: false });
    }
  },

  async loadSupplyCovers(supplies: RentalSupply[], items: PublicCabinet[], epoch: number) {
    const state = cabinetState(this);
    for (const supply of supplies) {
      if (state.covers.has(supply.asset_id)) continue;
      if (!state.visible || epoch !== state.epoch) return;
      const url=publicSupplyGallery(supply)[0]?.src;if(url)state.covers.set(supply.asset_id,url);
    }
    this.setData({cabinets:items.map(cabinet=>cabinetView(cabinet,state.covers))});
    this.setData({activeCabinet:selectedCabinetFor(this.data.cabinets as CabinetListView[],String(this.data.selectedCabinetId??''))});
  },

  onShow() { const state = cabinetState(this); state.visible = true; this.refreshType(); if (this.data.returnMode) { const returning = returnState(this), owner = accountApi.sessionIdentity() ?? ''; if (returning.owner !== owner) this.clearUnavailableReturn(); returning.show(owner); void this.refreshReturn(); } else void this.loadCabinets(); },

  onHide() { const state = cabinetState(this); state.visible = false; ++state.epoch; if (this.data.returnMode) { returnState(this).hide(); this.setData({ loading: false, cabinets: [], visibleCabinets: [], returnLocation: '', activeCabinet: null, canSelect: false, optionsLoaded: false, selectedCabinetId: '', cursor: null, returnTaskId: '', returnTaskCabinetId: '', returnTaskReserved: false, returnCopy: '' }); } },

  onUnload() { this.onHide(); cabinetStates.delete(this); returnStates.get(this)?.dispose(); returnStates.delete(this); },

  chooseRegion() { if (!this.data.returnMode) wx.navigateTo({ url: `/pages/region/index?region=${encodeURIComponent(this.data.region)}` }); },

  openStores() { if (!this.data.returnMode) wx.redirectTo({ url: '/pages/stores/index' }); },

  selectCabinet(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset['id'] ?? '');
    const cabinet = (this.data.cabinets as CabinetListView[]).find((candidate) => candidate.id === id);
    if (cabinet) this.setData({ selectedCabinetId: id, activeCabinet: cabinet });
  },

  openCabinet(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset['id'] ?? '');
    if (this.data.returnMode) {
      const state = returnState(this);
      if (!state.capture(accountApi.sessionIdentity)() || !this.data.canSelect || !this.data.cabinets.some(item => item.id === id && item.available)) return;
      state.navigation.navigateOnce('select-return-cabinet', callbacks => wx.navigateTo({ url: `/pages/cabinet-detail/index?mode=return&orderId=${encodeURIComponent(state.id)}&id=${encodeURIComponent(id)}`, ...callbacks }));
      return;
    }
    if (id) wx.navigateTo({ url: `/pages/cabinet-detail/index?id=${encodeURIComponent(id)}` });
  },

  openDevice(event: WechatMiniprogram.TouchEvent) {
    if (this.data.returnMode) return;
    const id = String(event.currentTarget.dataset['id'] ?? '');
    if (id) wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(id)}&source=cabinet` });
  },

  goBack() { wx.navigateBack(); },
demoSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
});
