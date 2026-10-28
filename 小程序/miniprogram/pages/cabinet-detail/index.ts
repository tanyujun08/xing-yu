import { rentalCabinetTaskCopy, rentalCabinetTaskLabel } from '../../shared/presentation/rental-order';
import { openSupplyLocation } from '../../shared/presentation/supply-location';
import { designAssets } from '../../shared/design/assets';
import { createOperationScope, type OperationScope } from '../../shared/interaction/operation-scope';
import { createNavigateOnce, type NavigateOnce } from '../../shared/interaction/navigate-once';
import { cabinetApi, type PublicCabinet, type RentalSupply } from '../../shared/api/supply-api';
import { publicSupplyGallery } from '../../shared/presentation/api-supply';
import { formatCNYMinorUnits } from '../../shared/format/money';
import { accountApi, ApiProblem } from '../../shared/api/account-api';
import { rentalOrderApi, type RentalOrder, type RentalTask } from '../../shared/api/rental-api';
import { createReturnCabinetState, readReturnCabinetContext, readReturnCabinetOption, returnTaskView } from '../../shared/interaction/return-cabinet-context';
import { rentalBlockers } from '../../shared/presentation/rental-order';

interface CabinetDisplay {
	  pickupScene?: string;
  id: string;
  name: string;
  address: string;
  region: string;
  distance: string;
  site: string;
  latitude?: number;
  longitude?: number;
}

interface SupplyDisplay {
  id: string;
  name: string;
  displayImage: string;
  displayDescription: string;
  displayTags: string[];
  supplyType: string;
  location: string;
  priceValue: string;
  priceUnit: string;
  depositValue: string;
}

interface CabinetDetailInteraction {
  scope: OperationScope;
  navigation: NavigateOnce;
  routeId: string;
  routeScene: string;
  loadEpoch: number;
  loadAbort: (() => void) | undefined;
  covers: Map<string, string>;
}

const interactions = new WeakMap<object, CabinetDetailInteraction>();
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
function interactionFor(page: object): CabinetDetailInteraction {
  const current = interactions.get(page);
  if (current) return current;
  const created = {
    scope: createOperationScope(),
    navigation: createNavigateOnce(),
    routeId: '',
    routeScene: '',
    loadEpoch: 0,
    loadAbort: undefined,
    covers: new Map<string, string>(),
  };
  interactions.set(page, created);
  return created;
}

function cabinetView(cabinet: PublicCabinet): CabinetDisplay {
  const latitude = Number(cabinet.address.location?.latitude);
  const longitude = Number(cabinet.address.location?.longitude);
  return {
    id: cabinet.cabinet_id,
    ...(cabinet.pickup_scene ? { pickupScene: cabinet.pickup_scene } : {}),
    name: cabinet.name,
    address: [cabinet.address.province_name, cabinet.address.city_name, cabinet.address.district_name, cabinet.address.detail_address].filter(Boolean).join(''),
    region: [cabinet.address.city_name, cabinet.address.district_name].filter(Boolean).join(''),
    distance: '',
    site: cabinet.deployment_site_name ?? '',
    ...(Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : {}),
  };
}

function supplyView(supply: RentalSupply, coverUrl: string): SupplyDisplay {
  return {
    id: supply.asset_id,
    name: supply.display_name,
    displayImage: coverUrl,
    displayDescription: supply.description,
    displayTags: [],
    supplyType: supply.supply_type.toLowerCase(),
    location: [supply.region?.city_name, supply.region?.district_name].filter(Boolean).join(''),
    priceValue: formatCNYMinorUnits(supply.unit_price_fen).slice(1),
    priceUnit: supply.rental_mode === 'HOUR' ? '/小时' : '/天',
    depositValue: formatCNYMinorUnits(supply.deposit_fen).slice(1),
  };
}

const emptyCabinet: CabinetDisplay = {
  id: '', name: '', address: '', region: '', distance: '', site: '',
};

Page({
  onSecondaryNavigationBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) }); },
  data: {
    selectedCompartment: '', selectedCompartmentNo: '',
    returnMode: false, loaded: false, canSelect: false, optionsLoaded: false, optionsFailed: false, hasAvailableCompartment: false, instructions: '', taskId: '', taskStatus: '', taskStatusLabel: '', taskCopy: '', canOpen: false, canCancel: false, canQuery: false,
    compartments: [] as { id: string; name: string; available: boolean; reason: string }[],
    icons: designAssets,
    heroImages: [designAssets.discoveryReferenceCabinet, designAssets.cabinetDetail1, designAssets.cabinetDetail2].map((src) => ({ id: src, src })),
    heroCurrent: 0,
    missing: false,
    loading: false,
    errorText: '',
    cabinet: emptyCabinet,
    devices: [] as SupplyDisplay[],
    entryView: 'detail',
    busy: false,
    selectingPhoto: false,
  },

  onHeroChange(event: WechatMiniprogram.CustomEvent<{ current: number }>) { this.setData({ heroCurrent: event.detail.current }); },

  onLoad(options: Record<string, string | undefined>) {
    const id = String(options.id ?? '').trim();
    const interaction = interactionFor(this);
    interaction.routeId = id;
    if (options['mode'] === 'return') { returnState(this).id = options['orderId'] ?? ''; this.setData({ returnMode: true }); return; }
    if (options.scene !== undefined) {
      try {
        const scene = decodeURIComponent(options.scene);
        if (!/^cab_[A-Za-z0-9]{20}$/.test(scene)) throw new Error('柜机码无效，请重新扫描柜上的小程序码。');
        interaction.routeScene = scene;
      } catch { interaction.routeId = ''; this.setData({ missing: true, errorText: '柜机码无效，请重新扫描柜上的小程序码。' }); return; }
    }
    if (!id && !interaction.routeScene) { this.setData({ missing: true }); return; }
    void this.loadCabinet(id);
  },

  onShow() {
    if (this.data.returnMode) { const state = returnState(this), owner = accountApi.sessionIdentity() ?? ''; if (state.owner !== owner) this.clearUnavailableReturn(); state.show(owner); void this.refresh(); return; }
    const interaction = interactionFor(this);
    if ((interaction.routeId || interaction.routeScene) && !this.data.loading && (!this.data.cabinet.id || this.data.errorText)) void this.loadCabinet(interaction.routeId);
  },

  onHide() {
    if (this.data.returnMode) { returnState(this).hide(); this.setData({ loaded: false, loading: false, busy: false, canSelect: false, canOpen: false, canCancel: false, canQuery: false, optionsLoaded: false, optionsFailed: false, hasAvailableCompartment: false, selectedCompartment: '', selectedCompartmentNo: '', compartments: [], taskId: '', taskStatus: '', taskStatusLabel: '', cabinet: emptyCabinet, instructions: '', taskCopy: '' }); }
    const interaction = interactions.get(this);
    if (!interaction) return;
    ++interaction.loadEpoch;
    interaction.loadAbort?.();
    interaction.loadAbort = undefined;
    interaction.covers.clear();
    interaction.scope.onHide();
    if (!this.data.returnMode) this.setData({ loading: false, busy: false, cabinet: emptyCabinet, devices: [] });
  },

  onUnload() {
    returnStates.get(this)?.dispose(); returnStates.delete(this);
    const interaction = interactions.get(this);
    interaction?.loadAbort?.();
    interaction?.scope.dispose();
    interaction?.navigation.dispose();
    interactions.delete(this);
  },

  clearUnavailableReturn() {
    const state = returnState(this); state.current = null; state.task = null;
    this.setData({ loaded: false, loading: false, busy: false, canSelect: false, canOpen: false, canCancel: false, canQuery: false, optionsLoaded: false, optionsFailed: false, hasAvailableCompartment: false, selectedCompartment: '', selectedCompartmentNo: '', compartments: [], taskId: '', taskStatus: '', taskStatusLabel: '', cabinet: emptyCabinet, instructions: '', taskCopy: '', errorText: '登录状态已失效或变化，请重新登录后读取本人归还柜机' });
  },
  async refresh() {
    const state = returnState(this), ownerActive = state.capture(accountApi.sessionIdentity), sequence = ++state.readSequence;
    const viewCurrent = captureReturnView(state), sessionLost = captureReturnSessionLoss(state), active = () => ownerActive() && sequence === state.readSequence;
    if (!active() || !state.owner) { if (viewCurrent()) this.clearUnavailableReturn(); return; }
    const previousCompartments = this.data.compartments;
    this.setData({ loading: true, errorText: '', canSelect: false, canOpen: false, canCancel: false, canQuery: false, optionsLoaded: false, optionsFailed: false, compartments: [] });
    try {
      const cabinetId = interactionFor(this).routeId;
      if (!state.id || !state.owner || !cabinetId) throw new Error('请从本人订单的归还选柜页进入');
      const context = await readReturnCabinetContext(rentalOrderApi, state.id, active);
      if (!context || !active()) return;
      state.current = context.order; state.task = context.task;
      const view = returnTaskView(context.task);
      this.setData({ loaded: true, instructions: context.order.value.requirements.return_instructions, ...view, taskStatusLabel: context.task ? rentalCabinetTaskLabel(context.task.value.status) : '', taskCopy: context.task ? rentalCabinetTaskCopy(context.task.value) : '', canOpen: view.canOpen && context.task?.value.cabinet_id === cabinetId, canCancel: view.canCancel && context.task?.value.cabinet_id === cabinetId });
      if (!context.canSelect) {
        const task = context.task?.value;
        if (task && task.status === 'RESERVED' && task.cabinet_id === cabinetId) this.setData({ selectedCompartment: task.compartment_id, selectedCompartmentNo: task.compartment_no, compartments: previousCompartments.length ? previousCompartments : [{ id: task.compartment_id, name: task.compartment_no, available: true, reason: '' }], cabinet: { ...emptyCabinet, id: cabinetId, name: task.cabinet_name, address: this.data.cabinet.address }, hasAvailableCompartment: true });
        return;
      }
      const cabinet = await readReturnCabinetOption(rentalOrderApi.cabinets, state.id, cabinetId, active);
      if (!active()) return;
      const compartments = cabinet?.compartments.map(slot => ({ id: slot.compartment_id, name: slot.compartment_no, available: slot.available, reason: rentalBlockers(slot.blockers) })) ?? [];
      this.setData({ selectedCompartment: compartments.some(v => v.id === this.data.selectedCompartment && v.available) ? this.data.selectedCompartment : '', selectedCompartmentNo: compartments.find(v => v.id === this.data.selectedCompartment && v.available)?.name ?? '', canSelect: true, optionsLoaded: true, hasAvailableCompartment: compartments.some(slot => slot.available), compartments, cabinet: { ...emptyCabinet, id: cabinetId, name: cabinet?.name ?? '当前归还柜机', address: cabinet?.address?.trim() || '地址未提供' } });
    } catch (error) { if (active()) this.setData({ optionsFailed: true, errorText: error instanceof Error ? error.message : '格口读取失败' }); }
    finally { if (sessionLost()) this.clearUnavailableReturn(); else if (active()) this.setData({ loading: false }); }
  },

  selectCompartment(event: WechatMiniprogram.TouchEvent) { const s = returnState(this); if (!s.capture(accountApi.sessionIdentity)() || !this.data.canSelect || this.data.busy) return; const slot = this.data.compartments.find(v => v.id === event.currentTarget.dataset['compartment'] && v.available); if (slot) this.setData({ selectedCompartment: slot.id, selectedCompartmentNo: slot.name }); },
  async confirmSelected() { const s = returnState(this), active = s.capture(accountApi.sessionIdentity); if (!active() || this.data.busy || !this.data.selectedCompartment) return; if (this.data.canSelect) await this.reserve({ currentTarget: { dataset: { compartment: this.data.selectedCompartment } } } as unknown as WechatMiniprogram.TouchEvent); if (active() && this.data.canOpen && !this.data.errorText) await this.taskAction({ currentTarget: { dataset: { action: 'open' } } } as unknown as WechatMiniprogram.TouchEvent); },
  async reselectCabinet() { const active = returnState(this).capture(accountApi.sessionIdentity); if (!active() || this.data.busy) return; if (this.data.canCancel) await this.taskAction({ currentTarget: { dataset: { action: 'cancel' } } } as unknown as WechatMiniprogram.TouchEvent); if (active() && this.data.canSelect) this.chooseAnotherCabinet(); },
  showReturnAddress() { if (returnState(this).capture(accountApi.sessionIdentity)()) void wx.showModal({ title: this.data.cabinet.name, content: this.data.cabinet.address || '请按现场柜机名称核对位置', showCancel: false, confirmText: '知道了' }); },
  async reserve(event: WechatMiniprogram.TouchEvent) {
    const state = returnState(this), compartment = String(event.currentTarget.dataset['compartment'] ?? '');
    await state.run('return-cabinet-command', async () => {
      const active = state.capture(accountApi.sessionIdentity), viewCurrent = captureReturnView(state), sessionLost = captureReturnSessionLoss(state);
      if (!active() || this.data.busy || !state.current || !this.data.canSelect || !this.data.compartments.some(slot => slot.id === compartment && slot.available)) return;
      this.setData({ busy: true });
      try {
        await rentalOrderApi.reserveCabinet(state.id, interactionFor(this).routeId, compartment, state.current.etag).promise;
        if (active()) await this.refresh();
      } catch (error) {
        if (active() && viewCurrent()) {
          if (error instanceof ApiProblem && [409, 412].includes(error.statusCode)) await this.refresh();
          if (active()) this.setData({ canSelect: false, canOpen: false, canCancel: false, errorText: error instanceof Error ? error.message : '预留结果待核实，请刷新原订单' });
        }
      } finally { if (active()) this.setData({ busy: false }); else if (sessionLost()) this.clearUnavailableReturn(); }
    });
  },

  async taskAction(event: WechatMiniprogram.TouchEvent) {
    const state = returnState(this), action = String(event.currentTarget.dataset['action'] ?? '');
    await state.run('return-cabinet-command', async () => {
      const active = state.capture(accountApi.sessionIdentity), viewCurrent = captureReturnView(state), sessionLost = captureReturnSessionLoss(state), task = state.task;
      if (!active() || this.data.busy || !task) return;
      if (action === 'open' && this.data.canOpen || action === 'cancel' && this.data.canCancel) {
        this.setData({ busy: true });
        try {
          if (action === 'open') await rentalOrderApi.openCabinet(task.value.task_id, null, task.etag).promise;
          else await rentalOrderApi.cancelCabinet(task.value.task_id, task.etag).promise;
          if (active()) { await this.refresh(); if (action === 'open' && active()) this.goResult(); }
        } catch (error) {
          if (active() && viewCurrent()) {
            await this.refresh();
            if (active()) this.setData({ canSelect: false, canOpen: false, canCancel: false, errorText: error instanceof Error ? error.message : '开柜结果待核实，请查询原任务' });
          }
        } finally { if (active()) this.setData({ busy: false }); else if (sessionLost()) this.clearUnavailableReturn(); }
      }
    });
  },
  goResult() { const state = returnState(this); if (state.capture(accountApi.sessionIdentity)() && state.task) state.navigation.navigateOnce('return-result', callbacks => wx.navigateTo({ url: '/pages/cabinet-return/index?orderId=' + encodeURIComponent(state.id), ...callbacks })); },
  chooseAnotherCabinet() {
    const state = returnState(this);
    if (!state.capture(accountApi.sessionIdentity)() || !this.data.canSelect || this.data.busy) return;
    state.navigation.navigateOnce('return-cabinets', callbacks => wx.redirectTo({ url: '/pages/cabinets/index?mode=return&orderId=' + encodeURIComponent(state.id), ...callbacks }));
  },
  goMaterials() { const state = returnState(this); if (state.capture(accountApi.sessionIdentity)()) state.navigation.navigateOnce('return-materials', callbacks => wx.navigateTo({ url: '/pages/return-submit/index?orderId=' + encodeURIComponent(state.id), ...callbacks })); },

  async loadCabinet(id: string) {
    const interaction = interactionFor(this);
    interaction.loadAbort?.();
    const epoch = ++interaction.loadEpoch;
    interaction.covers.clear();
    this.setData({ loading: true, missing: false, errorText: '', cabinet: emptyCabinet, devices: [] });
    try {
      const handle = interaction.routeScene ? cabinetApi.byScene(interaction.routeScene) : cabinetApi.detail(id);
      interaction.loadAbort = handle.abort;
      const response = await handle.promise;
      if (id && response.cabinet_id !== id) throw new Error('柜机编号与扫码入口不匹配，请重新扫码。');
      const cabinet = { ...response, supplies: response.supplies.filter(supply => supply.allowed_actions.some(action => action.code === 'QUOTE' && action.enabled)) };
      if (epoch !== interaction.loadEpoch) return;
      this.setData({ cabinet: cabinetView(cabinet), devices: cabinet.supplies.map((supply) => supplyView(supply, '')) });
      void this.loadCovers(cabinet, epoch);
    } catch (error) {
      if (epoch !== interaction.loadEpoch) return;
      this.setData({ errorText: error instanceof Error ? error.message : '柜机读取失败，请重试。', devices: [] });
    } finally {
      if (epoch === interaction.loadEpoch) this.setData({ loading: false });
    }
  },

  async loadCovers(cabinet: PublicCabinet, epoch: number) {
    const interaction = interactionFor(this);
    for (const supply of cabinet.supplies) {
      if(epoch!==interaction.loadEpoch||interaction.scope.disposed)return;
      const url=publicSupplyGallery(supply)[0]?.src;if(url)interaction.covers.set(supply.asset_id,url);
    }
    this.setData({devices:cabinet.supplies.map(item=>supplyView(item,interaction.covers.get(item.asset_id)??''))});
  },

  openDevice(event: WechatMiniprogram.TouchEvent) {
    if (this.data.returnMode) return;
    const id = String(event.currentTarget.dataset['id'] ?? '');
    if (id && this.data.devices.some(device => device.id === id)) interactionFor(this).navigation.navigateOnce(`cabinet-detail:device:${id}`, (callbacks) => wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(id)}&source=cabinet`, ...callbacks }));
  },

  pickupWithCode() {
    const interaction = interactionFor(this), scene = this.data.cabinet.pickupScene;
    if (this.data.returnMode || this.data.loading || this.data.busy || !this.data.cabinet.id) return;
    if (!scene || !/^cab_[A-Za-z0-9]{20}$/.test(scene)) { wx.showToast({ title: '当前柜机取件入口暂不可用，请刷新', icon: 'none' }); return; }
    interaction.navigation.navigateOnce('cabinet-pickup', callbacks => wx.navigateTo({ url: '/pages/cabinet-code/index?scene=' + encodeURIComponent(scene), ...callbacks }));
  },
  showAddress() { openSupplyLocation(this.data.cabinet); },
  goBack() { interactionFor(this).navigation.navigateOnce('cabinet-detail:back', (callbacks) => wx.navigateBack({ ...callbacks })); },
demoSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
});
