import { accountApi, ApiProblem } from '../../shared/api/account-api';
import { ownAssetsApi, publicationApi, type OwnRentalAssetDetail, type OwnRentalAssetItem } from '../../shared/api/rental-api';
import { ownMaterialMedia } from '../../shared/presentation/material-media';
import { designAssets } from '../../shared/design/assets';
import { formatDate } from '../../shared/format/date-time';
import { formatCNYMinorUnits } from '../../shared/format/money';
import { publicationLocalDay } from '../../shared/presentation/api-publication-draft';

type ListingView = {
  id: string; assetId: string; draftId: string; name: string; photoRefs: string[]; mediaState: 'real' | 'empty';
  statusText: string; statusCopy: string; filterGroup: string; price: string; deposit: string; deliveryText: string; createdDate: string;
  canContinue: boolean; canView: boolean; canEdit: boolean;
};
type OwnDetailView = {
  assetId: string; name: string; state: string; reviewStatus: string; reviewReason: string; publishStatus: string;
  latestRevisionId: string; currentRevisionId: string; condition: string; defectDescription: string; accessoriesText: string; description: string;
  rent: string; deposit: string; minimum: string; referenceValue: string; availableFrom: string; availableUntil: string;
  deliveryMethods: string; blockers: {id:string;code:string}[]; photos: {id:string;url:string}[]; hasDifferentCurrent: boolean; currentRent: string;
};

const statePresentation: Record<OwnRentalAssetItem['state'], { text: string; copy: string; group: string }> = {
  DRAFT: { text: '草稿', copy: '资料尚未提交，可继续填写后提交', group: '进行中' },
  REVIEWING: { text: '审核中', copy: '资料已提交，等待平台审核结果', group: '进行中' },
  REJECTED: { text: '已驳回', copy: '请根据审核意见修改资料后重新提交', group: '异常' },
  ONLINE: { text: '已上架', copy: '其他用户可以查看设备资料', group: '已上架' },
  OFFLINE: { text: '已下架', copy: '当前设备未对其他用户展示', group: '已下架' },
  OCCUPIED: { text: '履约中', copy: '设备存在进行中的订单或占用', group: '进行中' },
};
type EditIntent = { owner: string; version: string; key: string };
const editIntents = new WeakMap<object, Map<string, EditIntent>>();
const listEpochs = new WeakMap<object, number>();
const detailEpochs = new WeakMap<object, number>();
function invalidateListings(page: object): void { listEpochs.set(page, (listEpochs.get(page) ?? 0) + 1); detailEpochs.set(page, (detailEpochs.get(page) ?? 0) + 1); }
function pendingEdit(page: object, assetId: string, owner: string, version: string): EditIntent {
  let intents = editIntents.get(page);
  if (!intents) { intents = new Map(); editIntents.set(page, intents); }
  const prior = intents.get(assetId);
  if (prior && prior.owner === owner && prior.version === version) return prior;
  const intent = { owner, version, key: accountApi.newIntent('asset-edit-draft') };
  intents.set(assetId, intent);
  return intent;
}

function money(value?: string | null): string {
  if (value == null || !/^(0|[1-9][0-9]{0,19})$/.test(value)
    || (value.length === 20 && value > '18446744073709551615')) return '待设定';
  return formatCNYMinorUnits(value);
}
function enabled(item: OwnRentalAssetItem, code: string): boolean {
  return item.allowed_actions.some((action) => action.code === code && action.enabled);
}
async function toView(item: OwnRentalAssetItem,owner:string): Promise<ListingView> {
  const presentation = statePresentation[item.state];
  let photoRefs: string[] = [];
  if (item.cover_material_id) {
    try {
      const material=await publicationApi.material(item.cover_material_id).promise;
      if(accountApi.sessionIdentity()!==owner)throw new Error('账号已变化');
      const media=ownMaterialMedia(material,item.cover_material_id,owner,'RENTAL_ASSET_IMAGE');if(media)photoRefs=[media.src];
    } catch { photoRefs = []; }
  }
  return {
    id: item.resource_id, assetId: item.asset_id ?? '', draftId: item.draft_id ?? item.editable_draft_id ?? '',
    name: item.display_name || item.product_name || '未命名设备', photoRefs, mediaState: photoRefs.length > 0 ? 'real' : 'empty',
    statusText: presentation.text, statusCopy: presentation.copy, filterGroup: presentation.group,
    price: `${money(item.unit_price_fen)}${item.rental_unit === 'HOUR' ? '/小时' : '/天'}`, deposit: money(item.deposit_fen),
    deliveryText: item.delivery_methods.map((method) => ({ EXPRESS: '快递', RUNNER: '跑腿', MEET: '面交' } as Record<string, string>)[method] ?? method).join('、') || '未设置',
    createdDate: formatDate(item.updated_at), canContinue: enabled(item, 'CONTINUE_DRAFT'), canView: enabled(item, 'VIEW'),
    canEdit: enabled(item, 'OPEN_EDIT_DRAFT') || enabled(item, 'CREATE_EDIT_DRAFT'),
  };
}

async function toDetailView(detail: OwnRentalAssetDetail,owner:string): Promise<OwnDetailView> {
  const revision = detail.latest_revision ?? detail.current_revision;
  if (!revision) throw new Error('本人资产版本缺失，请刷新。');
  const photoIds = revision.media.filter((entry) => entry.role === 'COVER' || entry.role === 'IMAGE').sort((a, b) => a.sort_order - b.sort_order).map((entry) => entry.material_id);
  const photos = (await Promise.all(photoIds.map(async (id) => {
    try { const material=await publicationApi.material(id).promise;if(accountApi.sessionIdentity()!==owner)return null;const media=ownMaterialMedia(material,id,owner,'RENTAL_ASSET_IMAGE');return media?{id,url:media.src}:null; }
    catch { return null; }
  }))).filter((item):item is {id:string;url:string}=>item!==null);
  const current = detail.current_revision;
  return {
    assetId: detail.item.asset_id ?? '', name: revision.display_name, state: statePresentation[detail.item.state].text,
    reviewStatus: revision.review_status === 'PENDING' ? '待审核' : revision.review_status === 'REJECTED' ? '已驳回' : '已通过',
    reviewReason: revision.review_reason ?? '', publishStatus: detail.item.publish_status === 'ONLINE' ? '已上架' : '未上架',
    latestRevisionId: revision.revision_id, currentRevisionId: current?.revision_id ?? '', condition: revision.condition,
    defectDescription: revision.defect_description || '无', accessoriesText: revision.accessories_text || '无', description: revision.description || '无',
    rent: `${money(revision.unit_price_fen)}/${revision.rental_unit === 'HOUR' ? '小时' : '天'}`, deposit: money(revision.deposit_fen),
    minimum: `${revision.minimum_units} ${revision.rental_unit === 'HOUR' ? '小时' : '天'}`, referenceValue: money(revision.reference_value_fen),
    availableFrom: publicationLocalDay(revision.available_from), availableUntil: publicationLocalDay(revision.available_until, true),
    deliveryMethods: revision.delivery_options.map((option) => ({ EXPRESS: '快递', RUNNER: '跑腿', MEET: '面交' } as Record<string, string>)[option.method] ?? option.method).join('、') || '未设置',
    blockers: detail.publication_blockers.map(code=>({id:code,code})), photos, hasDifferentCurrent: !!current && current.revision_id !== revision.revision_id,
    currentRent: current ? `${money(current.unit_price_fen)}/${current.rental_unit === 'HOUR' ? '小时' : '天'}` : '',
  };
}

Page({
  data: { icons: designAssets, filters: [{id:'all',label:'全部'},{id:'processing',label:'进行中'},{id:'active',label:'已上架'},{id:'inactive',label:'已下架'},{id:'error',label:'异常'}], filter: '全部', listings: [] as ListingView[], loading: false, editingId: '', errorText: '', ownDetail: null as OwnDetailView | null, detailLoading: false, detailError: '' },
  onSecondaryNavigationBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) }); },
  onShow() { invalidateListings(this); this.setData({ listings: [], loading: false, editingId: '', errorText: '', ownDetail: null, detailLoading: false, detailError: '' }); void this.loadListings(); },
  onHide() { invalidateListings(this); this.setData({ listings: [], loading: false, editingId: '', errorText: '', ownDetail: null, detailLoading: false, detailError: '' }); },
  onUnload() { invalidateListings(this); editIntents.delete(this); this.setData({ listings: [], loading: false, ownDetail: null, detailLoading: false }); },
  async loadListings() {
    if (this.data.loading) return;
    const owner = accountApi.sessionIdentity();
    const epoch = (listEpochs.get(this) ?? 0) + 1;
    listEpochs.set(this, epoch);
    if (!owner) { this.setData({ listings: [], loading: false, errorText: '请先登录并刷新本人资产。' }); return; }
    const current = () => {
      if (listEpochs.get(this) !== epoch) return false;
      if (accountApi.sessionIdentity() === owner) return true;
      invalidateListings(this);
      this.setData({ listings: [], loading: false, errorText: '登录状态已变化，请刷新本人资产。' });
      return false;
    };
    this.setData({ loading: true, errorText: '' });
    try {
      const items: OwnRentalAssetItem[] = [];
      let cursor = '';
      do {
        const page = await ownAssetsApi.list('', cursor).promise;
        if (!current()) return;
        items.push(...page.items);
        cursor = page.page.has_more ? page.page.next_cursor ?? '' : '';
        if (page.page.has_more && !cursor) throw new Error('本人资产分页游标缺失。');
      } while (cursor && items.length < 200);
      const listings = await Promise.all(items.map(item=>toView(item,owner)));
      if (!current()) return;
      this.setData({ listings, loading: false });
    } catch (error) {
      if (!current()) return;
      this.setData({ listings: [], loading: false, errorText: error instanceof Error ? error.message : '本人资产读取失败，请重试。' });
    }
  },
  chooseFilter(event: WechatMiniprogram.TouchEvent) { this.setData({ filter: String(event.currentTarget.dataset['filter'] ?? '全部') }); },
  retry() { void this.loadListings(); },
  continueDraft(event: WechatMiniprogram.TouchEvent) { const id = String(event.currentTarget.dataset['id'] ?? ''); if (id) wx.navigateTo({ url: `/pages/publish/index?mode=draft&id=${encodeURIComponent(id)}` }); },
  async viewMaterial(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset['id'] ?? '');
    const owner = accountApi.sessionIdentity();
    if (!id || !owner) { this.setData({ detailError: '请先登录并刷新本人资产。' }); return; }
    const epoch = (detailEpochs.get(this) ?? 0) + 1;
    detailEpochs.set(this, epoch);
    this.setData({ ownDetail: null, detailLoading: true, detailError: '' });
    try {
      const detail = await ownAssetsApi.detail(id).promise;
      if (detailEpochs.get(this) !== epoch) return;
      if (accountApi.sessionIdentity() !== owner) throw new Error('登录状态已变化，请重新读取。');
      const ownDetail = await toDetailView(detail,owner);
      if (detailEpochs.get(this) !== epoch) return;
      if (accountApi.sessionIdentity() !== owner) throw new Error('登录状态已变化，请重新读取。');
      this.setData({ ownDetail, detailLoading: false });
    } catch (error) {
      if (detailEpochs.get(this) === epoch) this.setData({ ownDetail: null, detailLoading: false, detailError: error instanceof Error ? error.message : '本人资产详情读取失败。' });
    }
  },
  closeMaterial() { detailEpochs.set(this, (detailEpochs.get(this) ?? 0) + 1); this.setData({ ownDetail: null, detailLoading: false, detailError: '' }); },
  async editListing(event: WechatMiniprogram.TouchEvent) {
    if (this.data.editingId) return;
    const draftId = String(event.currentTarget.dataset['draft'] ?? ''); const assetId = String(event.currentTarget.dataset['asset'] ?? '');
    if (draftId) { wx.navigateTo({ url: `/pages/publish/index?mode=draft&draft_id=${encodeURIComponent(draftId)}` }); return; }
    const owner = accountApi.sessionIdentity();
    if (!assetId || !owner) { this.setData({ errorText: '请重新登录并刷新本人资产后再编辑。' }); return; }
    this.setData({ editingId: assetId, errorText: '' });
    try {
      const detail = await ownAssetsApi.detail(assetId).promise;
      if (accountApi.sessionIdentity() !== owner) throw new Error('登录状态已变化，请重新进入。');
      if (detail.item.editable_draft_id) {
        editIntents.get(this)?.delete(assetId);
        wx.navigateTo({ url: `/pages/publish/index?mode=draft&draft_id=${encodeURIComponent(detail.item.editable_draft_id)}` });
        return;
      }
      if (!detail.item.allowed_actions.some((action) => action.code === 'CREATE_EDIT_DRAFT' && action.enabled)) throw new Error('当前资产不允许新建编辑草稿，请刷新状态。');
      const intent = pendingEdit(this, assetId, owner, detail.item.version);
      const receipt = publicationApi.validateEditReceipt(await publicationApi.editDraft(assetId, intent.version, intent.key).promise, assetId, intent.version);
      if (accountApi.sessionIdentity() !== owner) throw new Error('登录状态已变化，请重新进入。');
      const draft = publicationApi.validateDraft(await publicationApi.draft(receipt.id).promise, receipt.id);
      if (draft.origin_kind !== 'EDIT' || draft.status !== 'EDITING' || draft.asset_id !== assetId
        || draft.base_version !== intent.version || draft.version !== receipt.version) throw new Error('编辑草稿回读与当前资产不一致，请刷新状态。');
      editIntents.get(this)?.delete(assetId);
      wx.navigateTo({ url: `/pages/publish/index?mode=draft&draft_id=${encodeURIComponent(receipt.id)}` });
    } catch (error) {
      const definitive = error instanceof ApiProblem && error.statusCode >= 400 && error.statusCode < 500 && ![408, 429].includes(error.statusCode);
      if (definitive) editIntents.get(this)?.delete(assetId);
      if (accountApi.sessionIdentity() === owner) this.setData({ errorText: error instanceof Error ? error.message : '编辑草稿结果未确认，请重试原请求。' });
    } finally { this.setData({ editingId: '' }); }
  },
});
