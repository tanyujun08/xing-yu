import { accountApi, addressApi, regionApi, findOwnAddress, type OwnAddress, type AddressInput } from '../../shared/api/account-api';
import { designAssets } from '../../shared/design/assets';
import { createNavigateOnce } from '../../shared/interaction/navigate-once';
import { createOperationScope } from '../../shared/interaction/operation-scope';

type Region = { code: string; name: string; level: string };
function createInteraction() {
  return { scope: createOperationScope(), navigation: createNavigateOnce(), owner: accountApi.sessionIdentity(),
    regionBefore: [] as Region[], datasetBefore: '', original: undefined as OwnAddress | undefined, pending: undefined as { body: AddressInput; intent: string } | undefined };
}
const interactions = new WeakMap<object, ReturnType<typeof createInteraction>>();
function interaction(page: object) { let value = interactions.get(page); if (!value) { value = createInteraction(); interactions.set(page, value); } return value; }
function tabs(path: Region[], level: number) { return Array.from({ length: Math.min(3, path.length + 1) }, (_, index) => ({ level: index, name: path[index]?.name ?? '请选择', active: index === level })); }
Page({
  data: { icons: designAssets, editingId: '', selectMode: false, missing: false, name: '', phone: '', region: '请选择地区', detail: '',
    isDefault: false, regionSheetOpen: false, regionDraft: [] as Region[], regionLevel: 0, regionOptions: [] as Region[], regionTabs: tabs([], 0),
    datasetId: '', dirty: false, saving: false, errorText: '', errorField: '', hasListParent: false },
  async onLoad(options: Record<string, string | undefined>) {
    const state = interaction(this);
    const stack = getCurrentPages();
    this.setData({ editingId: options.id ?? '', hasListParent: stack[stack.length - 2]?.route === 'pages/addresses/index' });
    if (!state.owner) { this.setData({ missing: true }); return; }
    if (!this.data.editingId) return;
    try {
      const address = await findOwnAddress(this.data.editingId);
      if (state.scope.disposed || state.owner !== accountApi.sessionIdentity()) return;
      if (!address || !address.allowed_actions.some((a) => a.code === 'UPDATE' && a.enabled)) { this.setData({ missing: true }); return; }
      state.original = address;
      const regionDraft = [{ code: address.province_id, name: address.province_name, level: 'PROVINCE' }, { code: address.city_id, name: address.city_name, level: 'CITY' }, { code: address.district_id, name: address.district_name, level: 'DISTRICT' }];
      this.setData({ name: address.recipient_name, phone: address.phone, region: regionDraft.map((item) => item.name).join(''), detail: address.detail_address,
        isDefault: address.is_default, datasetId: address.dataset_id, regionDraft });
    } catch (error) { if (!state.scope.disposed) this.setData({ missing: true, errorText: error instanceof Error ? error.message : '地址读取失败' }); }
  },
  onShow() { const state = interaction(this); if (!state.owner || state.owner !== accountApi.sessionIdentity()) this.setData({ missing: true, name: '', phone: '', detail: '', regionSheetOpen: false }); },
  onUnload() { const state = interaction(this); state.scope.dispose(); state.navigation.dispose(); interactions.delete(this); },
  input(event: WechatMiniprogram.Input) {
    if (interaction(this).pending) { this.setData({ errorText: '上次保存结果待确认，请先重试原请求或返回列表核对。' }); return; }
    const field = String(event.currentTarget.dataset['field'] ?? '');
    if (['name', 'phone', 'detail'].includes(field)) this.setData({ [field]: event.detail.value, dirty: true, errorText: '', errorField: '' });
  },
  openRegionSheet() { const state = interaction(this); if (!state.pending) { state.regionBefore = [...this.data.regionDraft]; state.datasetBefore = this.data.datasetId; this.setData({ regionSheetOpen: true }); return this.loadRegion(0); } },
  closeRegionSheet() { const state = interaction(this); this.setData({ regionSheetOpen: false, datasetId: state.datasetBefore, regionDraft: [...state.regionBefore] }); },
  changeRegionLevel(event: WechatMiniprogram.TouchEvent) { const level = Number(event.currentTarget.dataset['level']); if (Number.isInteger(level) && level >= 0 && level <= 2) return this.loadRegion(level); },
  async loadRegion(level: number) {
    const state = interaction(this);
    try {
      const result = await state.scope.latest('regions', () => regionApi.children(level === 0 ? undefined : this.data.datasetId || undefined, level ? this.data.regionDraft[level - 1]?.code : undefined).promise);
      if (!result.accepted || !this.data.regionSheetOpen) return;
      const regionDraft = level === 0 && this.data.datasetId !== result.value.dataset_id ? [] : this.data.regionDraft;
      this.setData({ datasetId: result.value.dataset_id, regionDraft, regionLevel: level, regionOptions: result.value.items.map((item) => ({ code: item.region_id, name: item.name, level: item.level })), regionTabs: tabs(regionDraft, level) });
    } catch (error) { if (!state.scope.disposed) this.setData({ errorText: error instanceof Error ? error.message : '地区读取失败' }); }
  },
  chooseRegion(event: WechatMiniprogram.TouchEvent) {
    const node = this.data.regionOptions.find((item) => item.code === String(event.currentTarget.dataset['code']));
    if (!node) return;
    const regionDraft = [...this.data.regionDraft.slice(0, this.data.regionLevel), node];
    this.setData({ regionDraft });
    if (node.level === 'DISTRICT' && regionDraft.length === 3) this.setData({ region: regionDraft.map((item) => item.name).join(''), regionSheetOpen: false, dirty: true });
    else return this.loadRegion(regionDraft.length);
  },
  toggleDefault() { if (!interaction(this).pending) this.setData({ isDefault: !this.data.isDefault, dirty: true }); },
  saveOnly() { return this.save(); },
  saveAndUse() { return this.save(); },
  save() {
    if (this.data.saving) return;
    const state = interaction(this);
    if (!state.owner || state.owner !== accountApi.sessionIdentity()) { this.setData({ missing: true }); return; }
    if (!this.data.name.trim() || !this.data.detail.trim() || !/^\d{5,32}$/.test(this.data.phone) || this.data.regionDraft.length !== 3 || !this.data.datasetId) {
      this.setData({ errorText: '请填写收货人、电话、完整地区和详细地址。' }); return;
    }
    const body: AddressInput = { dataset_id: this.data.datasetId, province_id: this.data.regionDraft[0]!.code, city_id: this.data.regionDraft[1]!.code,
      district_id: this.data.regionDraft[2]!.code, recipient_name: this.data.name.trim(), phone_country_code: state.original?.phone_country_code ?? '+86',
      phone: this.data.phone, detail_address: this.data.detail.trim(), is_default: this.data.isDefault, location: null };
    // Editing address text clears unverified coordinates. Unknown outcomes retain the exact original payload and intent.
    const pending = state.pending ?? { body, intent: accountApi.newIntent('address-save') };
    state.pending = pending;
    this.setData({ saving: true, errorText: '' });
    return state.scope.singleFlight('address-save', async () => {
      if (state.scope.disposed || state.owner !== accountApi.sessionIdentity()) return;
      try {
        const receipt = await (state.original ? addressApi.update(state.original, pending.body, pending.intent) : addressApi.create(pending.body, pending.intent)).promise;
        const saved = await findOwnAddress(receipt.address_id);
        if (!saved) throw new Error('保存回执已收到，当前地址回读待确认，请返回列表核对。');
        state.pending = undefined;
        state.original = saved;
        if (state.scope.disposed || state.owner !== accountApi.sessionIdentity()) return;
        this.setData({ editingId: saved.address_id, dirty: false });
        state.navigation.navigateOnce('saved-back', (callbacks) => wx.navigateBack({ ...callbacks, fail: (error) => { callbacks.fail(error); if (!state.scope.disposed) this.setData({ errorText: '地址已保存并回读，请返回地址列表。' }); } }));
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status && status >= 400 && status < 500) state.pending = undefined;
        if (!state.scope.disposed) this.setData({ errorText: error instanceof Error ? error.message : '保存结果待确认，请核对后重试原请求。' });
      } finally { if (!state.scope.disposed) this.setData({ saving: false }); }
    }).catch(() => undefined);
  },
  goBack() {
    if (this.data.saving) return;
    const state = interaction(this);
    const back = () => state.navigation.navigateOnce('back', (callbacks) => wx.navigateBack({ ...callbacks }));
    if (!this.data.dirty) { back(); return; }
    wx.showModal({ title: '放弃本次编辑？', content: state.pending ? '保存结果可能尚未确认，返回后请查询地址列表核对。' : '尚未保存的内容将丢失。', confirmText: '返回列表', success: state.scope.guard((result) => { if (result.confirm) back(); }) });
  },
});
