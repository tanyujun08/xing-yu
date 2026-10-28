import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Cascader,
  Form,
  Input,
  InputNumber,
  MessagePlugin,
  Select,
  Space,
  Table,
  type PrimaryTableCol,
} from 'tdesign-react';
import { AddIcon, RefreshIcon } from 'tdesign-icons-react';
import { permissions, useSession } from '../../shared/access/session';
import { PermissionGate } from '../../shared/access/PermissionGate';
import { useCommandSingleFlight } from '../../shared/commands/useCommandSingleFlight';
import { formatUTC } from '../../shared/format/time';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { useAdminServices, type Merchant, type OperatingAddress } from '../../shared/services';
import { mediaRefsFromUploads, type StagedMediaFile } from '../../shared/media/demoMedia';
import { AdminFormDrawer } from '../../shared/ui/AdminFormDrawer';
import { AdminActionConfirm } from '../../shared/ui/AdminActionConfirm';
import { AdminListPanel } from '../../shared/ui/AdminListPanel';
import { AdminAsyncState } from '../../shared/ui/AdminAsyncState';
import { classifyAdminAsyncError } from '../../shared/ui/adminAsyncStateModel';
import { FormGrid } from '../../shared/ui/FormGrid';
import { FormSection } from '../../shared/ui/FormSection';
import { ListFilterBar, ListFilterField } from '../../shared/ui/ListFilterBar';
import { ListPagination } from '../../shared/ui/ListPagination';
import { PageHeader } from '../../shared/ui/PageHeader';
import { MediaThumbnail } from '../../shared/ui/MediaThumbnail';
import { MediaUploadField } from '../../shared/ui/MediaUploadField';
import { StatusTag } from '../../shared/ui/StatusTag';
import { useListParams } from '../../shared/ui/useListParams';
import { composeFullAddress } from './addressProjection';
import { TencentAddressPicker } from './TencentAddressPicker';
import './merchants.css';
import { confirmedOperatingAddress, regionOption, resolveMapRegion, type RegionOption } from './merchantRegionSelection';

interface MerchantFormState extends Omit<OperatingAddress, 'longitude' | 'latitude' | 'confirmationStatus'>, Record<string, unknown> {
  photos: StagedMediaFile[];
  phoneDial: string;
  name: string;
  contactName: string;
  sharePercent: number;
  account: string;
  longitude: number | '';
  latitude: number | '';
  confirmationStatus: OperatingAddress['confirmationStatus'] | 'UNCONFIRMED';
}

const defaultOperatingAddress = {
  provinceCode: '',
  cityCode: '',
  districtCode: '',
  province: '',
  city: '',
  district: '',
  poiName: null,
  detailAddress: '',
  fullAddress: '',
  longitude: '' as const,
  latitude: '' as const,
  confirmationStatus: 'UNCONFIRMED' as const,
};

const initialMerchantForm: MerchantFormState = {
  photos: [],
  phoneDial: '',
  name: '',
  contactName: '',
  sharePercent: 25,
  account: '',
  ...defaultOperatingAddress,
};

function formatSharePercent(shareBps: number): string {
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(shareBps / 100)}%`;
}

function includesText(value: string, keyword: string): boolean {
  return value.toLocaleLowerCase('zh-CN').includes(keyword.trim().toLocaleLowerCase('zh-CN'));
}

const baseMerchantColumns: PrimaryTableCol<Merchant>[] = [
  {
    colKey: 'name',
    title: '商家',
    width: 240,
    cell: ({ row }) => (
      <div className="merchant-primary-cell"><MediaThumbnail mediaRef={row.coverMaterialId} alt={`${row.name}封面`} /><div className="table-primary"><strong>{row.name}</strong><small>{row.contactName}</small></div></div>
    ),
  },
  {
    colKey: 'operatingAddress',
    title: '经营地址',
    minWidth: 340,
    cell: ({ row }) => (
      <div className="merchant-address-cell">
        <strong>{row.operatingAddress.fullAddress}</strong>
        <small>{row.operatingAddress.longitude.toFixed(6)}, {row.operatingAddress.latitude.toFixed(6)}</small>
      </div>
    ),
  },
  { colKey: 'status', title: '状态', width: 100, cell: ({ row }) => <StatusTag value={row.status} /> },
  { colKey: 'shareBps', title: '默认分润', width: 120, cell: ({ row }) => formatSharePercent(row.shareBps) },
  { colKey: 'settlementCycle', title: '结算周期', width: 110, cell: () => '月结' },
  {
    colKey: 'settlementAccount',
    title: '结算账户',
    width: 190,
    cell: ({ row }) => <span className="mono-value">{row.settlementAccount}</span>,
  },
  { colKey: 'updatedAt', title: '最近更新', width: 190, cell: ({ row }) => formatUTC(row.updatedAt) },
];

export function MerchantsPage() {
  const { accountId } = useSession();
  return <MerchantsPageContent key={accountId ?? 'anonymous'} />;
}
function MerchantsPageContent() {
  const session = useSession();
  const services = useAdminServices();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const queryKeys = useAdminQueryKeys();
  const commands = useCommandSingleFlight();
  const [merchantDialogOpen, setMerchantDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Merchant | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Merchant | null>(null);
  const [merchantForm, setMerchantForm] = useState(initialMerchantForm);
  const [photosBlocked, setPhotosBlocked] = useState(false);
  const [mapRegionError, setMapRegionError] = useState('');
  const regionQuery = useQuery({
    queryKey: queryKeys.resource('merchants', 'regions', 'effective'),
    enabled: merchantDialogOpen && services.merchants.listRegions !== undefined,
    queryFn: ({ signal }) => services.merchants.listRegions!('', '', { signal }),
  });
  const [resolvedRegions, setResolvedRegions] = useState<{ datasetId: string; options: RegionOption[] } | null>(null);
  const regionOptions = resolvedRegions?.datasetId === regionQuery.data?.datasetId
    ? resolvedRegions?.options ?? [] : (regionQuery.data?.items ?? []).map(regionOption);
  const mapSelection = useRef<AbortController | null>(null);
  const invalidateMapSelection = () => { mapSelection.current?.abort(); mapSelection.current = null; };
  useEffect(() => () => { mapSelection.current?.abort(); }, []);
  const merchantFormController = Form.useForm()[0]!;
  const { page, pageSize, get, update, setFilters, resetFilters } = useListParams({ defaultPageSize: 10 });
  const nameFilter = get('name');
  const addressFilter = get('address');
  const regionFilter = get('region');
  const statusFilter = get('status');
  const apiMode = services.merchants.search !== undefined;
  const filterKey = JSON.stringify([nameFilter, addressFilter, regionFilter, statusFilter, pageSize]);
  const [paging, setPaging] = useState({ key: '', cursors: [''] });
  const cursors = paging.key === filterKey ? paging.cursors : [''];
  const apiPage = Math.min(page, cursors.length);
  const merchantsQuery = useQuery({ queryKey: queryKeys.resource('merchants', 'list', filterKey, apiMode ? String(apiPage) : 'all'), queryFn: async ({ signal }) => {
    if (services.merchants.search) return services.merchants.search({ name: nameFilter, address: addressFilter, region: regionFilter, status: statusFilter, cursor: cursors[apiPage - 1] ?? '', pageSize }, { signal });
    return { items: Array.from(await services.merchants.list({ signal })), hasMore: false, nextCursor: null };
  } });
  const changeStatus = useMutation({ mutationFn: (row: Merchant) => commands.run(row.id, 'status', (command) => services.merchants.changeStatus!(row, row.status === 'ACTIVE' ? 'deactivate' : 'activate', command)), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.domain('merchants') }); }, onError: async (error) => MessagePlugin.error(error instanceof Error ? error.message : '状态修改失败') });


  const filteredMerchants = useMemo(() => (merchantsQuery.data?.items ?? []).filter((merchant) => {
    if (apiMode) return true;
    const address = merchant.operatingAddress;
    const region = `${address.province}${address.city}${address.district}${address.fullAddress}`;
    return (
      (nameFilter === '' || includesText(`${merchant.name} ${merchant.contactName}`, nameFilter)) &&
      (addressFilter === '' || includesText(address.fullAddress, addressFilter)) &&
      (regionFilter === '' || includesText(region, regionFilter)) &&
      (statusFilter === '' || merchant.status === statusFilter)
    );
  }), [addressFilter, apiMode, merchantsQuery.data, nameFilter, regionFilter, statusFilter]);

  const maxPage = apiMode ? cursors.length : Math.max(1, Math.ceil(filteredMerchants.length / pageSize));
  const currentPage = Math.min(page, maxPage);
  const visibleMerchants = apiMode ? filteredMerchants : filteredMerchants.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  useEffect(() => {
    if (page > maxPage) update({ page: maxPage });
  }, [maxPage, page, update]);

  const closeMerchantDialog = () => {
    invalidateMapSelection();
    setMerchantDialogOpen(false);
    setMapRegionError('');
  };

  const saveMerchant = useMutation({
    mutationFn: () => {
      if (photosBlocked) throw new Error('请先完成或移除待处理商家图片');
      const operatingAddress = confirmedOperatingAddress(merchantForm);
      if (operatingAddress.fullAddress.trim() === '') throw new Error('请完整填写经营地址');
      if (!Number.isFinite(operatingAddress.longitude) || !Number.isFinite(operatingAddress.latitude)) {
        throw new Error('请通过腾讯地图确认有效经营位置');
      }
      const common = {
        photoMaterialIds: mediaRefsFromUploads(merchantForm.photos, session.apiMode),
        phoneDial: merchantForm.phoneDial,
        name: merchantForm.name,
        contactName: merchantForm.contactName,
        sharePercent: merchantForm.sharePercent,
        settlementAccount: merchantForm.account,
        operatingAddress,
      };
      return commands.run(editTarget?.id ?? 'new-merchant', 'save', (command) => editTarget === null ? services.merchants.create({ ...common, command }) : services.merchants.update({ ...common, merchantId: editTarget.id, command: { ...command, ...(editTarget.version ? { expectedVersion: editTarget.version } : {}) } }));
    },
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.domain('merchants') }), queryClient.invalidateQueries({ queryKey: queryKeys.domain('cabinets') }), queryClient.invalidateQueries({ queryKey: queryKeys.domain('finance') }), queryClient.invalidateQueries({ queryKey: queryKeys.domain('audit') })]);
      closeMerchantDialog();
      setMerchantForm(initialMerchantForm);
      setEditTarget(null);
      await MessagePlugin.success(editTarget === null ? '商家与经营地址已保存' : '商家信息已更新，历史快照保持不变');
    },
    onError: async (error) => MessagePlugin.error(error instanceof Error ? error.message : '商家录入失败'),
  });

  const archiveMerchant = useMutation({
    mutationFn: (merchant: Merchant) => commands.run(merchant.id, 'archive', (command) => services.merchants.archive({ id: merchant.id, reason: '后台人工删除', command: { ...command, ...(merchant.version ? { expectedVersion: merchant.version } : {}) } })),
    onSuccess: async () => { setArchiveTarget(null); await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.domain('merchants') }), queryClient.invalidateQueries({ queryKey: queryKeys.domain('audit') })]); await MessagePlugin.success('商家已逻辑归档'); },
    onError: async (error) => MessagePlugin.error(error instanceof Error ? error.message : '商家归档失败'),
  });

  const updateAddress = async (address: OperatingAddress, signal: AbortSignal) => {
    invalidateMapSelection();
    const controller = new AbortController();
    mapSelection.current = controller;
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) controller.abort();
    try {
      if (!services.merchants.listRegions) throw new Error('当前生效区划不可用');
      const resolved = await resolveMapRegion(address, services.merchants.listRegions, controller.signal);
      controller.signal.throwIfAborted();
      if (resolved.address.datasetId !== queryClient.getQueryData<{ datasetId: string }>(queryKeys.resource('merchants', 'regions', 'effective'))?.datasetId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.resource('merchants', 'regions', 'effective') });
        throw new Error('区划版本已变化，已刷新省市区，请重新选址');
      }
      setResolvedRegions({ datasetId: resolved.address.datasetId!, options: resolved.options });
      setMapRegionError('');
      setMerchantForm((current) => ({ ...current, ...resolved.address }));
      return resolved.address;
    } catch (error) {
      if (!controller.signal.aborted) setMapRegionError(error instanceof Error ? error.message : '区划匹配失败');
      throw error;
    } finally {
      signal.removeEventListener('abort', abort);
      if (mapSelection.current === controller) mapSelection.current = null;
    }
  };
  const updateAddressPart = (
    key: 'detailAddress',
    value: string,
  ) => {
    invalidateMapSelection();
    setMerchantForm((current) => {
      const address = { ...current, [key]: value };
      return { ...current, [key]: value, fullAddress: composeFullAddress(address), poiName: null, confirmationStatus: 'UNCONFIRMED', longitude: '', latitude: '' };
    });
  };

  const addressValue = {
    provinceCode: merchantForm.provinceCode,
    cityCode: merchantForm.cityCode,
    districtCode: merchantForm.districtCode,
    province: merchantForm.province,
    city: merchantForm.city,
    district: merchantForm.district,
    poiName: merchantForm.poiName,
    detailAddress: merchantForm.detailAddress,
    fullAddress: merchantForm.fullAddress,
    longitude: merchantForm.longitude,
    latitude: merchantForm.latitude,
    confirmationStatus: merchantForm.confirmationStatus === 'UNCONFIRMED' ? 'LEGACY_UNVERIFIED' as const : merchantForm.confirmationStatus,
  };

  const merchantColumns = useMemo<PrimaryTableCol<Merchant>[]>(() => [
    ...baseMerchantColumns,
    {
      colKey: 'actions', title: '操作', width: 220, fixed: 'right', cell: ({ row }) => (
          <Space size="small">
            <Button variant="text" onClick={() => navigate(`/merchants/${row.id}`)}>查看详情</Button>
            <PermissionGate permission={permissions.merchantManage}>
              <Space size="small">
            <Button variant="text" onClick={() => {
              if (editTarget?.id === row.id) { setMerchantDialogOpen(true); return; }
              setEditTarget(row);
              setMerchantForm({
                photos: (row.photoMaterialIds ?? []).map((materialId) => ({ id: materialId, materialId, name: materialId, mimeType: 'image/jpeg', size: 0, dataUrl: '' })),
                phoneDial: row.phoneDial ?? '',
                name: row.name, contactName: row.contactName, sharePercent: row.shareBps / 100,
                account: row.settlementAccount, ...row.operatingAddress,
              });
              setMerchantDialogOpen(true);
            }}>编辑</Button>
            <Button variant="text" disabled={!services.merchants.changeStatus || changeStatus.isPending} onClick={() => changeStatus.mutate(row)}>{row.status === 'ACTIVE' ? '停用' : '启用'}</Button>
            <Button theme="danger" variant="text" loading={commands.isPending(row.id, 'archive')} onClick={() => setArchiveTarget(row)}>删除</Button>
              </Space>
            </PermissionGate>
          </Space>
      ),
    },
  ], [changeStatus, commands, editTarget, navigate, services.merchants.changeStatus]);

  return (
    <div>
      <PageHeader
        title="商家管理"
        description="一个商家对应一个经营地址；租赁柜绑定商家时会回显该地址。"
        actions={(
          <PermissionGate permission={permissions.merchantManage}>
            <Button
              theme="primary"
              icon={<AddIcon />}
              onClick={() => {
                if (editTarget !== null) setMerchantForm(initialMerchantForm);
                setEditTarget(null);
                setMerchantDialogOpen(true);
              }}
            >
              新增商家
            </Button>
          </PermissionGate>
        )}
      />

      <AdminListPanel
        title="商家列表"
        count={filteredMerchants.length}
        filters={(
          <ListFilterBar
            ariaLabel="商家筛选"
            summary={`${apiMode ? '本页' : '已筛选'} ${filteredMerchants.length} 家`}
            actions={(
              <Button variant="text" icon={<RefreshIcon />} onClick={resetFilters}>重置筛选</Button>
            )}
          >
            <ListFilterField label="商家名称" wide>
              <Input
                value={nameFilter}
                clearable
                placeholder="名称或联系人"
                onChange={(name) => setFilters({ name })}
              />
            </ListFilterField>
            <ListFilterField label="经营地址" wide>
              <Input
                value={addressFilter}
                clearable
                placeholder="道路、门牌或场所"
                onChange={(address) => setFilters({ address })}
              />
            </ListFilterField>
            <ListFilterField label="省市区">
              <Input
                value={regionFilter}
                clearable
                placeholder="省 / 市 / 区"
                onChange={(region) => setFilters({ region })}
              />
            </ListFilterField>
            <ListFilterField label="状态">
              <Select
                value={statusFilter}
                clearable
                placeholder="全部状态"
                options={[
                  { label: '启用', value: 'ACTIVE' },
                  { label: '停用', value: 'INACTIVE' },
                ]}
                onChange={(status) => setFilters({ status: String(status ?? '') })}
              />
            </ListFilterField>
          </ListFilterBar>
        )}
        pagination={apiMode ? <nav className="list-pagination" aria-label="商家分页"><span>第 {apiPage} 页 · 本页 {filteredMerchants.length} 条</span><Space><Button disabled={apiPage <= 1 || merchantsQuery.isFetching} onClick={() => update({ page: apiPage - 1 })}>上一页</Button><Button disabled={!merchantsQuery.data?.hasMore || merchantsQuery.isFetching} onClick={() => { const next = merchantsQuery.data?.nextCursor; if (next) { setPaging({ key: filterKey, cursors: [...cursors.slice(0, apiPage), next] }); update({ page: apiPage + 1 }); } }}>下一页</Button></Space></nav> : filteredMerchants.length === 0 ? undefined : (
          <ListPagination
            current={currentPage}
            pageSize={pageSize}
            total={filteredMerchants.length}
            onChange={(nextPage, nextPageSize) => update({ page: nextPage, pageSize: nextPageSize })}
          />
        )}
      >
        {merchantsQuery.isError ? (
          <AdminAsyncState kind={classifyAdminAsyncError(merchantsQuery.error)} title="商家列表加载失败" actionLabel="重新加载" onAction={() => void merchantsQuery.refetch()} />
        ) : (
          <Table
            rowKey="id"
            data={Array.from(visibleMerchants)}
            columns={merchantColumns}
            loading={merchantsQuery.isLoading}
            hover
            empty={merchantsQuery.isLoading ? '正在加载商家' : '没有符合当前筛选条件的商家'}
          />
        )}
      </AdminListPanel>

      <AdminFormDrawer
        visible={merchantDialogOpen}
        title={editTarget === null ? '新增合作商家' : '编辑合作商家'}
        confirmText={editTarget === null ? '保存商家' : '保存修改'}
        form={merchantFormController}
        values={merchantForm}
        size="complex"
        pending={saveMerchant.isPending}
        submitBlocked={photosBlocked}
        dirty={JSON.stringify(merchantForm) !== JSON.stringify(initialMerchantForm)}
        onCancel={closeMerchantDialog}
        onSubmit={() => saveMerchant.mutateAsync().then(() => undefined)}
      >
        <FormSection title="合作信息">
          <FormGrid>
            <Form.FormItem name="name" label="商家名称" rules={[{ required: true, whitespace: true, message: '请输入商家名称' }]}>
              <Input
                value={merchantForm.name}
                onChange={(name) => setMerchantForm((current) => ({ ...current, name }))}
                placeholder="例如：南山影像空间"
              />
            </Form.FormItem>
            <Form.FormItem name="contactName" label="联系人" rules={[{ required: true, whitespace: true, message: '请输入联系人' }]}>
              <Input
                value={merchantForm.contactName}
                onChange={(contactName) => setMerchantForm((current) => ({ ...current, contactName }))}
                placeholder="请输入联系人姓名"
              />
            </Form.FormItem>
            <Form.FormItem name="phoneDial" label="联系电话" help="用于小程序商家详情页快捷拨打。" rules={[{ required: true, message: '请输入联系电话' }, { pattern: /^\+?[0-9]{5,31}$/, message: '请输入有效联系电话，区号与号码之间不加空格或横线' }]}><Input value={merchantForm.phoneDial} onChange={(phoneDial) => setMerchantForm((current) => ({ ...current, phoneDial }))} placeholder="请输入商家联系电话" /></Form.FormItem>
            <Form.FormItem
              name="sharePercent"
              label="默认分润比例"
              help="按百分比录入商家默认分润配置。"
              rules={[{ required: true, number: true, min: 0, max: 100, message: '请输入 0–100 的百分比' }]}
            >
              <InputNumber
                min={0}
                max={100}
                decimalPlaces={2}
                suffix="%"
                value={merchantForm.sharePercent}
                onChange={(sharePercent) => setMerchantForm((current) => ({ ...current, sharePercent: Number(sharePercent) }))}
              />
            </Form.FormItem>
            <Form.FormItem
              name="account"
              label="结算账户"
              help="完整录入并回显；系统加密保存，仅授权后台可见。"
              rules={[{ required: true, whitespace: true, message: '请输入结算账户' }]}
            >
              <Input
                value={merchantForm.account}
                onChange={(account) => setMerchantForm((current) => ({ ...current, account }))}
              />
            </Form.FormItem>
          </FormGrid>
        </FormSection>

        <FormSection title="商家封面与图片" description="最多 9 张，第一张作为商家封面；使用上移、下移调整顺序。">
          <FormGrid><Form.FormItem className="admin-form-grid__full" name="photos" label="商家图片（选填）"><MediaUploadField kind="image" materialClass="MERCHANT_IMAGE" ownerId={session.accountId} active={merchantDialogOpen} onStateChange={(state) => setPhotosBlocked(state.blocked)} max={9} allowReorder label="上传商家图片" value={merchantForm.photos} onChange={(photos) => setMerchantForm((current) => ({ ...current, photos }))} /></Form.FormItem></FormGrid>
        </FormSection>

        <FormSection title="经营地址" description="每个商家维护一个经营地址，通过腾讯地图确认位置。">
          {merchantDialogOpen && <TencentAddressPicker value={addressValue} onChange={updateAddress} />}
          {mapRegionError && <div role="alert">{mapRegionError}</div>}
          <FormGrid>
            <Form.FormItem className="admin-form-grid__full" name="districtId" label="省 / 市 / 区" rules={[{ required: true, message: '请选择省市区' }]}>
              <Cascader
                clearable
                options={regionOptions}
                load={async (node) => {
                  const dataset = regionQuery.data?.datasetId;
                  if (!dataset || !services.merchants.listRegions) throw new Error('当前生效区划不可用');
                  const result = await services.merchants.listRegions(dataset, String(node.value));
                  if (result.datasetId !== dataset) throw new Error('区划版本已变化，请刷新后重选');
                  return result.items.map((item) => ({
                    label: item.codeKind === 'SOURCE_EXTENSION' ? `${item.name}（来源扩展编码）` : item.isVirtual ? `${item.name}（联动用途）` : item.name,
                    value: item.id, ...(item.level === 'DISTRICT' ? {} : { children: true }), region: item,
                  }));
                }}
                value={merchantForm.datasetId === regionQuery.data?.datasetId ? merchantForm.districtId ?? '' : ''}
                placeholder={regionQuery.isError ? '区划加载失败，请稍后重试' : '请选择省 / 市 / 区'}
                onChange={(_value, context) => { invalidateMapSelection();
                  if (_value === '' || _value === null || _value === undefined) {
                    setMerchantForm((current) => {
                      const cleared = { ...current, ...defaultOperatingAddress };
                      delete cleared.datasetId; delete cleared.provinceId; delete cleared.cityId; delete cleared.districtId;
                      return cleared;
                    });
                    setMapRegionError('');
                    return;
                  }
                  const path = context.node?.getPath().map((node) => node.data.region).filter((item) => item !== undefined);
                  if (path?.length !== 3 || path[2]?.level !== 'DISTRICT' || !regionQuery.data) return;
                  const [province, city, district] = path;
                  setMerchantForm((current) => ({
                    ...current,
                    datasetId: regionQuery.data.datasetId, provinceId: province!.id, cityId: city!.id, districtId: district!.id,
                    provinceCode: province!.code, cityCode: city!.code, districtCode: district!.code,
                    province: province!.name, city: city!.name, district: district!.name,
                    fullAddress: composeFullAddress({ ...current, province: province!.name, city: city!.name, district: district!.name }),
                    poiName: null, confirmationStatus: 'UNCONFIRMED', longitude: '', latitude: '',
                  }));
                  setMapRegionError('');
                }}
              />
              {merchantForm.datasetId && regionQuery.data && merchantForm.datasetId !== regionQuery.data.datasetId && <small>历史地址属于旧区划版本，请重新选择省市区并确认地图位置。</small>}
            </Form.FormItem>
            <Form.FormItem name="detailAddress" label="详细地址" rules={[{ required: true, whitespace: true, message: '请输入道路、门牌或场所' }]}>
              <Input
                value={merchantForm.detailAddress}
                onChange={(detailAddress) => updateAddressPart('detailAddress', detailAddress)}
                placeholder="道路、门牌或场所名称"
              />
            </Form.FormItem>
            <Form.FormItem className="admin-form-grid__full" label="完整经营地址">
              <div className="merchant-form-address-preview" data-empty={merchantForm.fullAddress === ''}>
                {merchantForm.fullAddress || '完成省市区与详细地址后自动生成'}
              </div>
            </Form.FormItem>
            <Form.FormItem
              name="longitude"
              label="经度（GCJ-02）"
              rules={[{ required: true, number: true, min: -180, max: 180, message: '经度必须位于 -180 到 180' }]}
            >
              <InputNumber
                decimalPlaces={6}
                min={-180}
                max={180}
                suffix="°"
                value={merchantForm.longitude}
                readOnly
              />
            </Form.FormItem>
            <Form.FormItem
              name="latitude"
              label="纬度（GCJ-02）"
              rules={[{ required: true, number: true, min: -90, max: 90, message: '纬度必须位于 -90 到 90' }]}
            >
              <InputNumber
                decimalPlaces={6}
                min={-90}
                max={90}
                suffix="°"
                value={merchantForm.latitude}
                readOnly
              />
            </Form.FormItem>
            <Form.FormItem className="admin-form-grid__full" label="地址确认状态">
              <Space>
                <StatusTag value={merchantForm.confirmationStatus === 'TENCENT_CONFIRMED' ? 'ACTIVE' : 'INACTIVE'} />
                <span>{merchantForm.confirmationStatus === 'TENCENT_CONFIRMED' ? '腾讯地图已确认' : '地址变更后需重新确认'}</span>
              </Space>
            </Form.FormItem>
          </FormGrid>
        </FormSection>
      </AdminFormDrawer>

      <AdminActionConfirm
        visible={archiveTarget !== null}
        title="确认归档商家"
        objectLabel={archiveTarget?.name ?? ''}
        actionLabel="逻辑归档商家"
        impact="归档后商家将退出可操作列表，但历史订单、结算和经营地址快照不会被清理。"
        recoverable
        currentState={archiveTarget?.status}
        targetState="已归档"
        confirmText="确认归档"
        pending={archiveMerchant.isPending}
        onCancel={() => { if (!archiveMerchant.isPending) setArchiveTarget(null); }}
        onConfirm={() => { if (archiveTarget !== null) archiveMerchant.mutate(archiveTarget); }}
      />
    </div>
  );
}
