import { accountApi, ApiProblem } from '../../shared/api/account-api';
import { publicationApi, type AssetDraft, type AssetDraftInput } from '../../shared/api/rental-api';
import { createNavigateOnce, navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { createOperationScope } from '../../shared/interaction/operation-scope';
import { draftMoneyInput, publicationDraftView } from '../../shared/presentation/api-publication-draft';

type PublicationUpdateIntent = ReturnType<typeof publicationApi.prepareUpdateIntent>;
type PublicationSubmitIntent = ReturnType<typeof publicationApi.prepareSubmitIntent>;
type ListingSummary = { name: string; category: string };
type Runtime = {
  id: string; owner: string | null; visible: boolean; epoch: number; forcedView: boolean;
  scope: ReturnType<typeof createOperationScope>; navigation: ReturnType<typeof createNavigateOnce>;
  resource?: AssetDraft | undefined; updateIntent?: PublicationUpdateIntent | undefined; submitIntent?: PublicationSubmitIntent | undefined;
};

const states = new WeakMap<object, Runtime>();
const dayMilliseconds = 86_400_000;
const shanghaiOffsetMilliseconds = 8 * 3_600_000;
const opaque = (value: unknown): value is string => typeof value === 'string' && /^[!-~]{1,64}$/.test(value);
const explicitRejection = (error: unknown) => error instanceof ApiProblem && error.statusCode >= 400 && error.statusCode < 500
  && ![401, 408, 429].includes(error.statusCode);

function exact(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((item, index) => exact(item, right[index]));
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const leftRecord = left as Record<string, unknown>; const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort(); const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && exact(leftRecord[key], rightRecord[key]));
}

function initial() {
  return {
    loggedIn: false, loading: false, submitting: false, editable: false, pendingUpdate: false, pendingSubmit: false, hasDraftTarget: false,
    listing: null as ListingSummary | null,
    guidanceText: '价格、可租日期和提交资格由服务端权威校验。', rent: '', deposit: '', priceUnitLabel: '日租金', priceUnitSuffix: '/天',
    availabilityStart: '', availabilityEnd: '', availabilityStartLabel: '', availabilityEndLabel: '', deliveryText: '',
    deliveryItems: [] as Array<{ key: string; label: string }>, errorText: '', noticeText: '', primaryActionText: '提交审核',
  };
}

function current(page: object, runtime: Runtime, owner = runtime.owner, epoch = runtime.epoch): boolean {
  return states.get(page) === runtime && runtime.visible && !runtime.scope.disposed && runtime.epoch === epoch
    && owner !== null && runtime.owner === owner && owner === accountApi.sessionIdentity();
}

function localDayMilliseconds(value: string): number {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/u.test(value)) throw new Error('请选择有效的可租日期。');
  const milliseconds = Date.parse(value + 'T00:00:00.000Z');
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().substring(0, 10) !== value) throw new Error('请选择有效的可租日期。');
  return milliseconds;
}
function requestBoundary(value: string, exclusiveEnd: boolean): string {
  return new Date(localDayMilliseconds(value) + (exclusiveEnd ? dayMilliseconds : 0) - shanghaiOffsetMilliseconds).toISOString();
}
function responseDay(value: string | undefined, exclusiveEnd: boolean): string {
  if (value === undefined) return '';
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error('草稿日期无效，请重新读取。');
  const local = new Date(milliseconds + shanghaiOffsetMilliseconds).toISOString();
  if (local.slice(11) !== '00:00:00.000Z') throw new Error('草稿日期边界无效，请重新读取。');
  const day = local.substring(0, 10);
  return exclusiveEnd ? new Date(localDayMilliseconds(day) - dayMilliseconds).toISOString().substring(0, 10) : day;
}
function dateLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value); if (!match) return value;
  return `${match[2]!.replace(/^0/u, '')}月${match[3]!.replace(/^0/u, '')}日`;
}

function renderDraft(page: { setData(patch: Record<string, unknown>): void }, runtime: Runtime, draft: AssetDraft, noticeText: string): void {
  const displayAsset = runtime.updateIntent?.body.asset ?? draft.asset;
  const view = publicationDraftView({ ...draft, asset: displayAsset });
  const start = responseDay(displayAsset.available_from, false); const end = responseDay(displayAsset.available_until, true);
  if (start && end && end < start) throw new Error('草稿可租日期无效，请重新读取。');
  const pendingUpdate = !!runtime.updateIntent; const pendingSubmit = !!runtime.submitIntent;
  const editable = draft.status === 'EDITING' && !runtime.forcedView;
  runtime.resource = draft;
  page.setData({
    loggedIn: true, loading: false, listing: { name: view.displayName || '未命名设备', category: `${view.priceUnitLabel} · ${draft.origin_kind === 'EDIT' ? '资产修改草稿' : '设备发布草稿'}` },
    editable, pendingUpdate, pendingSubmit, rent: view.expectedRent, deposit: view.expectedDeposit, priceUnitLabel: view.priceUnitLabel,
    priceUnitSuffix: displayAsset.rental_unit === 'HOUR' ? '/小时' : '/天', availabilityStart: start, availabilityEnd: end,
    availabilityStartLabel: dateLabel(start), availabilityEndLabel: dateLabel(end), deliveryText: view.deliveryText,
    deliveryItems: view.deliveries.filter(item => item.selected).map(item => ({ key: item.id, label: item.label })),
    errorText: '', noticeText,
    primaryActionText: pendingSubmit ? '重试原提交审核' : pendingUpdate ? '重试原保存并提交' : '提交审核',
  });
}

function draftAssetFromForm(page: { data: ReturnType<typeof initial> }, draft: AssetDraft): AssetDraftInput {
  if (!page.data.rent || !page.data.deposit) throw new Error('请填写租金和押金。');
  if (!page.data.availabilityStart || !page.data.availabilityEnd) throw new Error('请确认可租日期。');
  const startMilliseconds = localDayMilliseconds(page.data.availabilityStart); const endMilliseconds = localDayMilliseconds(page.data.availabilityEnd);
  if (endMilliseconds < startMilliseconds) throw new Error('结束日期不能早于开始日期。');
  return { ...draft.asset, unit_price_fen: draftMoneyInput(page.data.rent), deposit_fen: draftMoneyInput(page.data.deposit),
    available_from: requestBoundary(page.data.availabilityStart, false), available_until: requestBoundary(page.data.availabilityEnd, true), timezone: 'Asia/Shanghai' };
}

/**
 * Compares the form with the projections it was rendered from, so an untouched form is never
 * treated as an edit. Comparing the rebuilt request body instead would compare raw timestamp
 * strings, and RFC3339 seconds without a fractional part differ textually from the page's
 * millisecond form even though they name the same instant.
 */
function formMatchesDraft(page: { data: ReturnType<typeof initial> }, draft: AssetDraft): boolean {
  const view = publicationDraftView(draft);
  return page.data.rent === view.expectedRent && page.data.deposit === view.expectedDeposit
    && page.data.availabilityStart === responseDay(draft.asset.available_from, false)
    && page.data.availabilityEnd === responseDay(draft.asset.available_until, true);
}

Page({
  data: initial(),
  onLoad(options: Record<string, string | undefined>) {
    const id = options.draft_id ?? (options.mode === 'draft' ? options.id : '') ?? '';
    states.set(this, { id, owner: null, visible: false, epoch: 0, forcedView: options.mode === 'view', scope: createOperationScope(), navigation: createNavigateOnce() });
    this.setData({ hasDraftTarget: id !== '' });
  },
  onShow() {
    const runtime = states.get(this); if (!runtime) return;
    runtime.scope.dispose(); runtime.scope = createOperationScope(); runtime.visible = true; ++runtime.epoch;
    const owner = accountApi.sessionIdentity();
    if (owner !== runtime.owner) { runtime.resource = undefined; runtime.updateIntent = undefined; runtime.submitIntent = undefined; }
    runtime.owner = owner; this.setData({ ...initial(), hasDraftTarget: runtime.id !== '' }); return this.reloadDraft();
  },
  onHide() {
    const runtime = states.get(this); if (!runtime) return;
    runtime.visible = false; ++runtime.epoch; runtime.scope.dispose(); runtime.resource = undefined; runtime.updateIntent = undefined; runtime.submitIntent = undefined; this.setData(initial());
  },
  onUnload() {
    const runtime = states.get(this); if (!runtime) return;
    runtime.visible = false; ++runtime.epoch; runtime.scope.dispose(); runtime.navigation.dispose(); states.delete(this); this.setData(initial());
  },
  async reloadDraft() {
    const runtime = states.get(this); if (!runtime || !runtime.visible || runtime.scope.disposed) return;
    const owner = accountApi.sessionIdentity(); const epoch = ++runtime.epoch;
    runtime.resource = undefined; runtime.updateIntent = undefined; runtime.submitIntent = undefined;
    this.setData({ ...initial(), loggedIn: !!owner, loading: !!owner, hasDraftTarget: runtime.id !== '' });
    if (!owner || owner !== runtime.owner) { this.setData({ loggedIn: false, loading: false, errorText: '请登录后查看本人草稿。' }); return; }
    try {
      if (!opaque(runtime.id)) throw new Error('草稿标识无效，请从发布页重新进入。');
      runtime.updateIntent = publicationApi.readUpdateIntent(owner, runtime.id) ?? undefined;
      runtime.submitIntent = publicationApi.readSubmitIntent(owner, runtime.id) ?? undefined;
      if (runtime.updateIntent && runtime.submitIntent) throw new Error('草稿存在两项待核实请求，请先联系平台核实。');
      const handle = publicationApi.draft(runtime.id); const unregister = runtime.scope.registerCleanup(handle.abort); let value: unknown;
      try { value = await handle.promise; } finally { unregister(); }
      if (!current(this, runtime, owner, epoch)) return;
      const draft = publicationApi.validateDraft(value, runtime.id); let noticeText = '已读取当前草稿';
      if (runtime.updateIntent?.stage === 'LOCATED') {
        const intent = runtime.updateIntent;
        if (draft.status !== 'EDITING' || draft.version !== intent.resultVersion || !exact(draft.asset, intent.body.asset)) throw new Error('保存草稿回读与原请求不一致，请继续核实原请求。');
        publicationApi.releaseUpdateIntent(intent); runtime.updateIntent = undefined; noticeText = '价格保存已确认，请再次确认提交审核';
      }
      if (runtime.submitIntent?.stage === 'LOCATED') {
        const intent = runtime.submitIntent;
        if (draft.status !== 'SUBMITTED' || draft.version !== intent.resultVersion || draft.asset_id !== intent.assetId || draft.committed_revision_id !== intent.revisionId) throw new Error('提交审核回读与原请求不一致，请继续核实原请求。');
        publicationApi.releaseSubmitIntent(intent); runtime.submitIntent = undefined; noticeText = '提交审核已确认，已回读当前草稿状态';
      }
      renderDraft(this, runtime, draft, runtime.submitIntent ? '上次提交结果未确认，请重试原提交。' : runtime.updateIntent ? '上次保存结果未确认，请重试原保存。' : noticeText);
    } catch (error) { if (current(this, runtime, owner, epoch)) this.setData({ errorText: error instanceof Error ? error.message : '草稿读取失败。' }); }
    finally {
      if (states.get(this) === runtime && runtime.visible && epoch === runtime.epoch) {
        if (owner !== accountApi.sessionIdentity()) { runtime.resource = undefined; runtime.updateIntent = undefined; runtime.submitIntent = undefined; this.setData({ ...initial(), errorText: '登录状态已变化，请重新登录。' }); }
        else this.setData({ loading: false });
      }
    }
  },
  handleErrorAction() { return this.reloadDraft(); },
  input(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const runtime = states.get(this);
    if (!runtime || !current(this, runtime) || !runtime.resource || runtime.resource.status !== 'EDITING' || runtime.forcedView || runtime.updateIntent || runtime.submitIntent || this.data.submitting) return;
    const field = String(event.currentTarget.dataset['field'] ?? '');
    if (field === 'rent') this.setData({ rent: String(event.detail.value ?? ''), errorText: '', noticeText: '' });
    if (field === 'deposit') this.setData({ deposit: String(event.detail.value ?? ''), errorText: '', noticeText: '' });
  },
  changeStartDate(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const runtime = states.get(this); if (!runtime || !current(this, runtime) || !this.data.editable || runtime.updateIntent || runtime.submitIntent || this.data.submitting) return;
    const value = String(event.detail.value ?? '');
    try { localDayMilliseconds(value); const end = !this.data.availabilityEnd || value > this.data.availabilityEnd ? value : this.data.availabilityEnd;
      this.setData({ availabilityStart: value, availabilityEnd: end, availabilityStartLabel: dateLabel(value), availabilityEndLabel: dateLabel(end), errorText: '', noticeText: '' });
    } catch (error) { this.setData({ errorText: error instanceof Error ? error.message : '请选择有效的可租日期。' }); }
  },
  changeEndDate(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const runtime = states.get(this); if (!runtime || !current(this, runtime) || !this.data.editable || runtime.updateIntent || runtime.submitIntent || this.data.submitting) return;
    const value = String(event.detail.value ?? '');
    try { localDayMilliseconds(value); if (!this.data.availabilityStart || value < this.data.availabilityStart) throw new Error('结束日期不能早于开始日期。');
      this.setData({ availabilityEnd: value, availabilityEndLabel: dateLabel(value), errorText: '', noticeText: '' });
    } catch (error) { this.setData({ errorText: error instanceof Error ? error.message : '请选择有效的可租日期。' }); }
  },
  confirm() {
    const runtime = states.get(this); if (!runtime || !current(this, runtime) || this.data.submitting || (!runtime.resource && !runtime.submitIntent)) return Promise.resolve();
    const owner = runtime.owner!; const epoch = runtime.epoch;
    return runtime.scope.singleFlight('listing-price-submit', async () => {
      if (!current(this, runtime, owner, epoch)) return;
      let mustReload = false; this.setData({ submitting: true, errorText: '', noticeText: '' });
      try {
        let draft = runtime.resource; if (!draft) throw new Error('请先重新读取草稿。');
        if (!runtime.updateIntent && !runtime.submitIntent) {
          if (draft.status !== 'EDITING' || runtime.forcedView) throw new Error('当前草稿不能修改或提交。');
          if (!formMatchesDraft(this, draft)) {
            const nextAsset = draftAssetFromForm(this, draft);
            runtime.updateIntent = publicationApi.prepareUpdateIntent(owner, runtime.id, draft.version, nextAsset);
          }
        }
        if (runtime.updateIntent) {
          let update = runtime.updateIntent;
          if (update.stage === 'PREPARED') {
            try {
              const handle = publicationApi.updateDraft(update.draftId, update.version, update.body.asset, update.key); const unregister = runtime.scope.registerCleanup(handle.abort); let receipt: unknown;
              try { receipt = await handle.promise; } finally { unregister(); }
              if (!current(this, runtime, owner, epoch)) return;
              const verified = publicationApi.validateUpdateReceipt(receipt, update.draftId, update.version);
              update = publicationApi.locateUpdateIntent(update, verified.version); runtime.updateIntent = update;
            } catch (error) {
              if (explicitRejection(error)) { publicationApi.releaseRejectedUpdateIntent(update); runtime.updateIntent = undefined; runtime.resource = undefined; mustReload = true; }
              throw error;
            }
          }
          if (!current(this, runtime, owner, epoch) || update.stage !== 'LOCATED') return;
          const handle = publicationApi.draft(update.draftId); const unregister = runtime.scope.registerCleanup(handle.abort); let value: unknown;
          try { value = await handle.promise; } finally { unregister(); }
          if (!current(this, runtime, owner, epoch)) return;
          const readback = publicationApi.validateDraft(value, update.draftId);
          if (readback.status !== 'EDITING' || readback.version !== update.resultVersion || !exact(readback.asset, update.body.asset)) throw new Error('保存草稿回读与原请求不一致，请继续核实原请求。');
          publicationApi.releaseUpdateIntent(update); runtime.updateIntent = undefined; runtime.resource = readback; draft = readback;
        }
        let submit = runtime.submitIntent;
        if (!submit) { if (draft.status !== 'EDITING') throw new Error('当前草稿不能提交审核。'); submit = publicationApi.prepareSubmitIntent(owner, draft.draft_id, draft.version); runtime.submitIntent = submit; }
        if (submit.stage === 'PREPARED') {
          try {
            const handle = publicationApi.submitDraft(submit.draftId, submit.version, submit.key); const unregister = runtime.scope.registerCleanup(handle.abort); let receipt: unknown;
            try { receipt = await handle.promise; } finally { unregister(); }
            if (!current(this, runtime, owner, epoch)) return;
            const verified = publicationApi.validateSubmitReceipt(receipt, submit.draftId);
            submit = publicationApi.locateSubmitIntent(submit, verified.version, verified.asset_id, verified.revision_id); runtime.submitIntent = submit;
          } catch (error) {
            if (explicitRejection(error)) { publicationApi.releaseSubmitIntent(submit); runtime.submitIntent = undefined; runtime.resource = undefined; mustReload = true; }
            throw error;
          }
        }
        if (!current(this, runtime, owner, epoch) || submit.stage !== 'LOCATED') return;
        const handle = publicationApi.draft(submit.draftId); const unregister = runtime.scope.registerCleanup(handle.abort); let value: unknown;
        try { value = await handle.promise; } finally { unregister(); }
        if (!current(this, runtime, owner, epoch)) return;
        const finalDraft = publicationApi.validateDraft(value, submit.draftId);
        if (finalDraft.status !== 'SUBMITTED' || finalDraft.version !== submit.resultVersion || finalDraft.asset_id !== submit.assetId
          || finalDraft.committed_revision_id !== submit.revisionId || !exact(finalDraft.asset, draft.asset)) throw new Error('提交审核回读与原请求不一致，请继续核实原请求。');
        publicationApi.releaseSubmitIntent(submit); runtime.submitIntent = undefined; runtime.resource = finalDraft;
        renderDraft(this, runtime, finalDraft, '提交审核已确认，已回读当前草稿状态'); wx.showToast({ title: '已提交审核', icon: 'success' });
        runtime.navigation.navigateOnce('submitted-draft', callbacks => wx.redirectTo({ url: `/pages/publish/index?draft_id=${encodeURIComponent(finalDraft.draft_id)}&mode=view`, ...callbacks }));
      } catch (error) {
        if (current(this, runtime, owner, epoch)) this.setData({ errorText: error instanceof Error ? error.message : '提交审核结果未确认，请重试原请求。',
          listing: mustReload ? null : this.data.listing, primaryActionText: runtime.submitIntent ? '重试原提交审核' : runtime.updateIntent ? '重试原保存并提交' : '提交审核' });
      } finally {
        if (states.get(this) === runtime && runtime.visible && epoch === runtime.epoch) {
          if (owner !== accountApi.sessionIdentity()) { runtime.resource = undefined; runtime.updateIntent = undefined; runtime.submitIntent = undefined; this.setData({ ...initial(), errorText: '登录状态已变化，请重新登录。' }); }
          else this.setData({ submitting: false, pendingUpdate: !!runtime.updateIntent, pendingSubmit: !!runtime.submitIntent });
        }
      }
    }).catch((error: unknown) => { if (current(this, runtime, owner, epoch)) this.setData({ submitting: false, errorText: error instanceof Error ? error.message : '提交审核失败。' }); });
  },
  edit() {
    const runtime = states.get(this); if (!runtime || !runtime.visible || !opaque(runtime.id) || this.data.submitting || runtime.updateIntent || runtime.submitIntent) return;
    runtime.navigation.navigateOnce('edit-draft', callbacks => wx.navigateTo({ url: `/pages/publish/index?draft_id=${encodeURIComponent(runtime.id)}&mode=draft`, ...callbacks }));
  },
  openLogin() { const runtime = states.get(this); if (runtime?.visible) runtime.navigation.navigateOnce('login', callbacks => wx.navigateTo({ url: '/pages/login/index?source=listing-price', ...callbacks })); },
  onSecondaryNavigationBack() { const runtime = states.get(this); if (runtime?.visible) navigateBackWithFallback(runtime.navigation); },
  goBack() { this.onSecondaryNavigationBack(); },
});
