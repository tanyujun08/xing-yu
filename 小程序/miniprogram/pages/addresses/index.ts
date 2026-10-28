import { accountApi, addressApi, ApiProblem, type OwnAddress } from '../../shared/api/account-api';
import { designAssets } from '../../shared/design/assets';
import { createNavigateOnce, navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { createOperationScope } from '../../shared/interaction/operation-scope';

function createInteraction() {
  return { scope: createOperationScope(), navigation: createNavigateOnce(), rows: new Map<string, OwnAddress>(),
    visible: true, epoch: 0, owner: accountApi.sessionIdentity(), pending: new Map<string, { intent: string; address: OwnAddress }>() };
}
const interactions = new WeakMap<object, ReturnType<typeof createInteraction>>();
function interaction(page: object) {
  let value = interactions.get(page);
  if (!value) { value = createInteraction(); interactions.set(page, value); }
  return value;
}
function projection(address: OwnAddress) {
  return { id: address.address_id, name: address.recipient_name, phone: address.phone,
    region: address.province_name + address.city_name + address.district_name, detail: address.detail_address,
    isDefault: address.is_default, canEdit: address.allowed_actions.some((a) => a.code === 'UPDATE' && a.enabled),
    canDefault: address.allowed_actions.some((a) => a.code === 'DEFAULT' && a.enabled),
    canArchive: address.allowed_actions.some((a) => a.code === 'ARCHIVE' && a.enabled) };
}
Page({
  data: { icons: designAssets, loggedIn: false, addresses: [] as ReturnType<typeof projection>[], selectMode: false,
    errorText: '', loading: false, hasMore: false, nextCursor: '', busy: false },
  onSecondaryNavigationBack() { navigateBackWithFallback(interaction(this).navigation); },
  onLoad(options: Record<string, string | undefined>) {
    const state = interaction(this);
    if (!accountApi.sessionIdentity()) wx.showModal({ title: '请先登录', content: '登录后管理本人收货地址。', confirmText: '去登录', success: state.scope.guard((result) => { if (result.confirm) this.openEditor(''); }) });
    this.setData({ selectMode: options.mode === 'select', secondaryNavigationTitle: options.mode === 'select' ? '选择收货地址' : '地址管理' });
  },
  onShow() { interaction(this).visible = true; void this.refresh(); },
  onHide() { interaction(this).visible = false; this.setData({ addresses: [] }); interaction(this).rows.clear(); },
  onUnload() { const state = interaction(this); state.scope.dispose(); state.navigation.dispose(); interactions.delete(this); },
  async refresh() {
    const state = interaction(this);
    const owner = accountApi.sessionIdentity();
    ++state.epoch;
    if (state.owner !== owner) { state.pending.clear(); state.rows.clear(); this.setData({ addresses: [] }); state.owner = owner; }
    this.setData({ loggedIn: owner !== null, loading: owner !== null, errorText: '' });
    if (!owner) { this.setData({ addresses: [], loading: false, hasMore: false }); return; }
    try {
      const result = await state.scope.latest('addresses', async () => {
        const handle = addressApi.list();
        const release = state.scope.registerCleanup(handle.abort);
        try { return await handle.promise; } finally { release(); }
      });
      if (!result.accepted || !state.visible || owner !== accountApi.sessionIdentity()) return;
      state.rows = new Map(result.value.items.map((item) => [item.address_id, item]));
      this.setData({ addresses: result.value.items.map(projection), hasMore: result.value.page.has_more, nextCursor: result.value.page.next_cursor ?? '' });
    } catch (error) {
      if (!state.scope.disposed) this.setData({ errorText: error instanceof Error ? error.message : '地址读取失败' });
    } finally {
      if (!state.scope.disposed) this.setData({ loading: false });
    }
  },
  async onPullDownRefresh() { try { await this.refresh(); } finally { wx.stopPullDownRefresh(); } },
  onReachBottom() {
    if (this.data.loading || !this.data.hasMore || !this.data.nextCursor) return;
    const state = interaction(this);
    const cursor = this.data.nextCursor;
    const epoch = state.epoch;
    this.setData({ loading: true });
    void state.scope.singleFlight('more', async () => {
      try {
        const result = await addressApi.list(cursor).promise;
        if (state.scope.disposed || !state.visible || epoch !== state.epoch || cursor !== this.data.nextCursor || state.owner !== accountApi.sessionIdentity()) return;
        const patch: Record<string, unknown> = { hasMore: result.page.has_more, nextCursor: result.page.next_cursor ?? '' };
        let position = this.data.addresses.length;
        for (const item of result.items) {
          if (!state.rows.has(item.address_id)) { patch[`addresses[${position++}]`] = projection(item); state.rows.set(item.address_id, item); }
        }
        this.setData(patch);
      } catch (error) { if (!state.scope.disposed) this.setData({ errorText: error instanceof Error ? error.message : '加载失败' }); }
      finally { if (!state.scope.disposed) this.setData({ loading: false }); }
    }).catch(() => undefined);
  },
  newAddress() { this.openEditor(''); },
  editAddress(event: WechatMiniprogram.TouchEvent) { this.openEditor(String(event.currentTarget.dataset['id'] ?? '')); },
  openEditor(id: string) {
    const state = interaction(this);
    if (!accountApi.sessionIdentity()) {
      state.navigation.navigateOnce('login', (callbacks) => wx.navigateTo({ url: '/pages/login/index?source=addresses', ...callbacks })); return;
    }
    if (id && !state.rows.get(id)?.allowed_actions.some((a) => a.code === 'UPDATE' && a.enabled)) return;
    state.navigation.navigateOnce('editor', (callbacks) => wx.navigateTo({ url: '/pages/address-edit/index?id=' + encodeURIComponent(id), ...callbacks }));
  },
  chooseAddress(event: WechatMiniprogram.TouchEvent) {
    if (!this.data.selectMode) return;
    const id = String(event.currentTarget.dataset['id'] ?? '');
    if (!interaction(this).rows.has(id)) return;
    this.getOpenerEventChannel?.().emit?.('addressSelected', { addressId: id });
    navigateBackWithFallback(interaction(this).navigation);
  },
  setDefault(event: WechatMiniprogram.TouchEvent) { this.changeAddress(String(event.currentTarget.dataset['id'] ?? ''), 'DEFAULT'); },
  removeAddress(event: WechatMiniprogram.TouchEvent) {
    const state = interaction(this);
    const id = String(event.currentTarget.dataset['id'] ?? '');
    wx.showModal({ title: '删除地址', content: '删除后无法恢复，是否继续？', confirmText: '删除', success: state.scope.guard((result) => {
      if (result.confirm) this.changeAddress(id, 'ARCHIVE');
    }) });
  },
  changeAddress(id: string, action: 'DEFAULT' | 'ARCHIVE') {
    if (this.data.busy) return;
    const state = interaction(this);
    const address = state.rows.get(id);
    if (!address || state.owner !== accountApi.sessionIdentity()) return;
    const key = action + ':' + id;
    const pending = state.pending.get(key) ?? { intent: accountApi.newIntent('address-' + action), address };
    state.pending.set(key, pending);
    this.setData({ busy: true, errorText: '' });
    void state.scope.singleFlight('address-command', async () => {
      try {
        if (state.scope.disposed || state.owner !== accountApi.sessionIdentity()) return;
        await addressApi.transition(pending.address, action, pending.intent).promise;
        state.pending.delete(key);
        if (!state.scope.disposed) await this.refresh();
      } catch (error) {
        if (error instanceof ApiProblem && error.statusCode === 412) {
          state.pending.delete(key);
          if (!state.scope.disposed) await this.refresh();
        }
        if (!state.scope.disposed) this.setData({ errorText: error instanceof Error ? error.message : '操作结果待确认，请刷新地址' });
      } finally { if (!state.scope.disposed) this.setData({ busy: false }); }
    }).catch(() => undefined);
  },
});
