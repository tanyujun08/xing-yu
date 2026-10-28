import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Input, InputNumber, MessagePlugin, Select, Space, Table, Tag, Textarea, type PrimaryTableCol } from 'tdesign-react';
import { AddIcon } from 'tdesign-icons-react';
import { PermissionGate } from '../../shared/access/PermissionGate';
import { permissions, useSession } from '../../shared/access/session';
import { useCommandSingleFlight } from '../../shared/commands/useCommandSingleFlight';
import { formatFenExact } from '../../shared/format/money';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { useAdminServices, type Asset, type AssetPrivateReviewDetails, type LessorProfile, type Product, type RentalType } from '../../shared/services';
import { AdminFormDrawer } from '../../shared/ui/AdminFormDrawer';
import { AdminListPanel } from '../../shared/ui/AdminListPanel';
import { AdminAsyncState } from '../../shared/ui/AdminAsyncState';
import { classifyAdminAsyncError } from '../../shared/ui/adminAsyncStateModel';
import { AdminTabPanel, AdminTabs } from '../../shared/ui/AdminTabs';
import { FormGrid } from '../../shared/ui/FormGrid';
import { FormSection } from '../../shared/ui/FormSection';
import { ListFilterBar, ListFilterField } from '../../shared/ui/ListFilterBar';
import { ListPagination } from '../../shared/ui/ListPagination';
import { mediaRefsFromUploads, type StagedMediaFile } from '../../shared/media/demoMedia';
import { MediaThumbnail } from '../../shared/ui/MediaThumbnail';
import { MediaVideoPreview } from '../../shared/ui/MediaVideoPreview';
import { MediaUploadField } from '../../shared/ui/MediaUploadField';
import { PageHeader } from '../../shared/ui/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag';
import { paginateListRows, useListParams } from '../../shared/ui/useListParams';
import { AssetStockingDrawer } from './AssetStockingDrawer';
import { readAssetCabinetDirectory, unplacedAssetLocation } from './assetCabinetLocation';
import { AssetPublicationAction } from './AssetPublicationAction';
import './assets.css';

interface Workspace { assets: readonly Asset[]; products: readonly Product[]; lessors: readonly LessorProfile[] }

interface OfficialBatchFormState {
  [key: string]: unknown;
  productId: string; displayName: string; rfidCode: string; condition: string; defectDescription: string; accessoryDescription: string;
  rentalType: RentalType; unitPriceFen: number; minimumUnits: number; depositFen: number; referenceValueFen: number;
  images: StagedMediaFile[]; videos: StagedMediaFile[];
}

const initialBatchForm: OfficialBatchFormState = {
  productId: '', displayName: '', rfidCode: '', condition: '全新投放', defectDescription: '', accessoryDescription: '',
  rentalType: 'DAY' as RentalType, unitPriceFen: 29_900, minimumUnits: 3, depositFen: 500_000, referenceValueFen: 1_699_900,
  images: [], videos: [],
};
const availabilityOptions = [
  { label: '可租', value: 'AVAILABLE' },
  { label: '已预约', value: 'RESERVED' },
  { label: '租赁中', value: 'RENTING' },
  { label: '待归还', value: 'RETURN_PENDING' },
  { label: '维修中', value: 'MAINTENANCE' },
  { label: '冻结', value: 'FROZEN' },
  { label: '已退役', value: 'RETIRED' },
];

export function AssetsPage() {
  const { accountId } = useSession();
  return <AssetsPageContent key={accountId ?? 'anonymous'} />;
}
function AssetsPageContent() {
  const services = useAdminServices();
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const queryKeys = useAdminQueryKeys();
  const commands = useCommandSingleFlight();
  const [activeTab, setActiveTab] = useState('ALL');
  const [batchOpen, setBatchOpen] = useState(false);
  const [imagesBlocked, setImagesBlocked] = useState(false);
  const [videosBlocked, setVideosBlocked] = useState(false);
  const mediaBlocked = imagesBlocked || videosBlocked;
  const [stockingAsset, setStockingAsset] = useState<Asset | null>(null);
  const [reviewAsset, setReviewAsset] = useState<Asset | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewReason, setReviewReason] = useState('');
  const [privateDetails, setPrivateDetails] = useState<AssetPrivateReviewDetails | null>(null);
  const [privateDetailsBusy, setPrivateDetailsBusy] = useState(false);
  const privateReadGeneration = useRef(0);
  const privateExpiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [batchForm, setBatchForm] = useState(initialBatchForm);
  const batchController = Form.useForm()[0]!;
  const reviewController = Form.useForm()[0]!;
  const list = useListParams({ defaultPageSize: 10, pageKey: 'assetPage', pageSizeKey: 'assetPageSize' });
  const batchDrawerValues = useMemo(() => ({
    ...batchForm,
    unitPriceFen: batchForm.unitPriceFen / 100,
    depositFen: batchForm.depositFen / 100,
    referenceValueFen: batchForm.referenceValueFen / 100,
  }), [batchForm]);

  const workspaceQuery = useQuery<Workspace>({
    queryKey: queryKeys.resource('assets', 'workspace'),
    queryFn: async ({ signal }) => {
      const [assets, products, lessors] = await Promise.all([services.assets.list({ signal }), services.catalog.listProducts({ signal }), services.assets.listLessors({ signal })]);
      return { assets, products, lessors };
    },
  });
  const workspace = workspaceQuery.data;
  const officialLessors = (workspace?.lessors ?? []).filter((lessor) => lessor.lessorKind === 'PLATFORM' && lessor.businessMode === 'B2C' && lessor.status === 'ACTIVE');
  const officialLessor = officialLessors.length === 1 ? officialLessors[0] : undefined;
  const assets = useMemo(() => Array.from(workspace?.assets ?? []), [workspace?.assets]);
  const locationIdentity = assets.map((asset) => `${asset.id}:${asset.cabinetId ?? ''}:${asset.boxId ?? ''}`).join('|');
  const cabinetDirectory = useQuery({
    queryKey: queryKeys.resource('assets', 'cabinet-directory', locationIdentity),
    enabled: workspace !== undefined && services.cabinetManagement !== undefined,
    queryFn: ({ signal }) => readAssetCabinetDirectory(services.cabinetManagement!, assets, signal),
    retry: false,
  });
  const keyword = list.get('keyword').trim().toLocaleLowerCase('zh-CN');
  const supply = list.get('supply');
  const presence = list.get('presence');
  const availability = list.get('availability');
  const cabinetId = list.get('cabinetId');
  const businessStatus = list.get('businessStatus');
  const baseRows = assets.filter((asset) => activeTab === 'ALL' || (activeTab === 'OFFICIAL' ? asset.supplyMode === 'OFFICIAL' : asset.supplyMode === 'C2C'));
  const filtered = baseRows.filter((asset) => {
    const product = workspace?.products.find((candidate) => candidate.id === asset.productId);
    const lessor = workspace?.lessors.find((candidate) => candidate.id === asset.lessorId);
    return (keyword === '' || [asset.assetNo, asset.displayName, asset.identifierValue, product?.name ?? '', lessor?.displayName ?? ''].some((value) => value.toLocaleLowerCase('zh-CN').includes(keyword)))
      && (supply === '' || asset.supplyMode === supply)
      && (presence === '' || (presence === 'IN_CABINET' ? asset.supplyMode === 'OFFICIAL' && asset.boxId !== null : presence === 'OUT_OF_CABINET' ? asset.supplyMode === 'OFFICIAL' && asset.boxId === null : asset.supplyMode === 'C2C'))
      && (availability === '' || asset.availabilityStatus === availability)
      && (cabinetId === '' || asset.cabinetId === cabinetId)
      && (businessStatus === '' || asset.publishStatus === businessStatus || asset.reviewStatus === businessStatus);
  });
  const page = paginateListRows(filtered, list.page, list.pageSize);
  const invalidateAssets = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.domain('assets') }),
    queryClient.invalidateQueries({ queryKey: queryKeys.domain('cabinets') }),
    queryClient.invalidateQueries({ queryKey: queryKeys.domain('audit') }),
  ]);
  const closeReview = () => {
    privateReadGeneration.current += 1;
    if (privateExpiryTimer.current !== null) clearTimeout(privateExpiryTimer.current);
    privateExpiryTimer.current = null;
    setReviewAsset(null);
    setReviewReason('');
    setPrivateDetails(null);
    setPrivateDetailsBusy(false);
  };
  const readPrivateDetails = async () => {
    if (!reviewAsset?.latestRevisionId || !services.assets.readPrivateReviewDetails) return;
    const generation = ++privateReadGeneration.current;
    setPrivateDetailsBusy(true);
    setPrivateDetails(null);
    try {
      const details = await services.assets.readPrivateReviewDetails(reviewAsset.id, reviewAsset.latestRevisionId);
      if (generation === privateReadGeneration.current) {
        if (privateExpiryTimer.current !== null) clearTimeout(privateExpiryTimer.current);
        setPrivateDetails(details);
        privateExpiryTimer.current = setTimeout(() => {
          if (generation === privateReadGeneration.current) setPrivateDetails(null);
          privateExpiryTimer.current = null;
        }, Math.max(0, Date.parse(details.expiresAt) - Date.now()));
      }
    } catch (error) {
      if (generation === privateReadGeneration.current) await MessagePlugin.error(error instanceof Error ? error.message : '私密地址读取失败');
    } finally {
      if (generation === privateReadGeneration.current) setPrivateDetailsBusy(false);
    }
  };

  const batchMutation = useMutation({
    mutationFn: async () => {
      if (mediaBlocked) throw new Error('请先完成或移除待处理素材');
      if (batchForm.rfidCode !== '' && !/^(?!00000000$)[0-9A-Fa-f]{8}$/.test(batchForm.rfidCode)) throw new Error('RFID 必须为 8 位十六进制字符（0–9、A–F）；00000000 为空位标记，不可绑定');
      const { images, videos, rfidCode, ...assetFields } = batchForm;
      const imageMediaIds = mediaRefsFromUploads(images, session.apiMode);
      const created = await services.assets.createOfficialBatch({
      ...assetFields,
      ...(imageMediaIds.length === 0 ? {} : { coverMediaId: imageMediaIds[0], imageMediaIds }),
      ...(videos.length === 0 ? {} : { videoMediaIds: mediaRefsFromUploads(videos, session.apiMode) }),
      identifiers: [{ identifierType: 'PLATFORM_TAG' as const, ...(rfidCode === '' ? {} : { rfidCode: rfidCode.toUpperCase() }) }],
      defectDescription: batchForm.defectDescription, accessoryDescription: batchForm.accessoryDescription, publishStatus: 'OFFLINE',
      });
      if (created.length !== 1) throw new Error('创建回执必须恰好有一条资产，请刷新列表核对结果');
      return created;
    },
    onSuccess: async () => { await invalidateAssets(); setBatchOpen(false); setBatchForm(initialBatchForm); await MessagePlugin.success('已建立 1 台官方资产'); },
    onError: async (error) => MessagePlugin.error(error instanceof Error ? error.message : '资产创建失败'),
  });
  const reviewMutation = useMutation({
    mutationFn: (input: { assetId: string; expectedRevisionId: string; decision: 'APPROVE' | 'REJECT'; reviewRemark: string }) => commands.run(input.assetId, `review-${input.decision}`, (command) => services.assets.review({ ...input, command })),
    onSuccess: async () => { await invalidateAssets(); closeReview(); await MessagePlugin.success('资产审核已处理'); },
    onError: async (error) => MessagePlugin.error(error instanceof Error ? error.message : '审核未完成，请刷新核对版本'),
  });

  const columns: PrimaryTableCol<Asset>[] = [
    { colKey: 'asset', title: '资产', width: 210, cell: ({ row }) => <div className="asset-primary-cell asset-primary-cell--media"><MediaThumbnail mediaRef={row.coverMediaId ?? row.imageMediaIds[0]} alt={`${row.displayName}设备图片`} /><div><strong>{row.displayName}</strong><span>资产编号：{row.assetNo}</span></div></div> },
    { colKey: 'identifier', title: '设备唯一标识', width: 150, cell: ({ row }) => <span className="asset-identifier">{row.identifierValue}</span> },
    { colKey: 'lessor', title: '来源 / 发布方', width: 105, cell: ({ row }) => { const lessor = workspace?.lessors.find((candidate) => candidate.id === row.lessorId); return <div className="asset-primary-cell"><Tag size="small" theme={row.supplyMode === 'OFFICIAL' ? 'primary' : 'warning'} variant="light">{row.supplyMode === 'OFFICIAL' ? '官方资产' : '用户发布'}</Tag><span>{lessor?.displayName ?? row.lessorId}</span></div>; } },
    { colKey: 'terms', title: '租金 / 押金', width: 115, cell: ({ row }) => <div className="asset-primary-cell"><strong>{formatFenExact(row.unitPriceFenRaw ?? row.unitPriceFen)} / {row.rentalType === 'DAY' ? '天' : '小时'}</strong><span>押金 {formatFenExact(row.depositFenRaw ?? row.depositFen)}</span></div> },
    { colKey: 'presence', title: '在柜状态', width: 80, cell: ({ row }) => row.supplyMode === 'C2C' ? <span className="asset-presence-na" aria-label="个人资产在柜状态不适用">—</span> : row.boxId === null ? <Tag size="small" theme="warning" variant="light">不在柜</Tag> : <Tag size="small" theme="success" variant="light">在柜</Tag> },
    { colKey: 'location', title: '当前位置', width: 140, cell: ({ row }) => row.supplyMode === 'C2C' ? row.publishLocationSnapshot?.fullAddress ?? '—' : row.boxId === null ? unplacedAssetLocation(row) : cabinetDirectory.data?.locations[row.id]?.cabinetBox ?? (cabinetDirectory.isError || !services.cabinetManagement ? '柜机格口读取失败' : '正在读取柜机格口…') },
    { colKey: 'availability', title: '租赁状态', width: 80, cell: ({ row }) => <StatusTag value={row.availabilityStatus} /> },
    { colKey: 'status', title: '上架 / 审核', width: 100, cell: ({ row }) => <Space direction="vertical" size={4}><StatusTag value={row.publishStatus} label={row.publishStatus === 'ONLINE' ? '已上架' : '未上架'} />{row.supplyMode === 'C2C' ? <StatusTag value={row.reviewStatus} /> : null}</Space> },
    { colKey: 'actions', title: '操作', width: 170, fixed: 'right', cell: ({ row }) => <Space breakLine size={4}><Button size="small" variant="text" onClick={() => navigate(`/assets/${row.id}`)}>查看详情</Button>{row.supplyMode === 'OFFICIAL' && row.boxId === null && row.publishStatus === 'OFFLINE' && row.availabilityStatus === 'AVAILABLE' && services.cabinetManagement !== undefined ? <PermissionGate permission={permissions.assetManage}><PermissionGate permission={permissions.cabinetManage}><Button size="small" theme="primary" variant="text" onClick={() => setStockingAsset(row)}>资产入柜</Button></PermissionGate></PermissionGate> : null}{row.supplyMode === 'C2C' && row.reviewStatus === 'PENDING' ? <PermissionGate permission={permissions.assetReview}><Button size="small" theme="primary" variant="text" onClick={() => { closeReview(); setReviewAsset(row); setReviewDecision('APPROVE'); }}>核对并审核</Button></PermissionGate> : null}{row.supplyMode === 'OFFICIAL' ? <PermissionGate permission={permissions.assetManage}><AssetPublicationAction asset={row} /></PermissionGate> : null}</Space> },
  ];

  return <div>
    <PageHeader title="资产管理" description="一行对应一台设备，可查看归属、位置和当前租赁状态。" actions={<PermissionGate permission={permissions.assetManage}><Button theme="primary" icon={<AddIcon />} onClick={() => setBatchOpen(true)}>新增官方资产</Button></PermissionGate>} />
    <AdminTabs value={activeTab} onChange={(value) => { setActiveTab(String(value)); list.update({ assetPage: 1 }); }}>
      <AdminTabPanel value="ALL" label="全部" />
      <AdminTabPanel value="OFFICIAL" label="官方资产" />
      <AdminTabPanel value="C2C" label="用户发布" />
    </AdminTabs>
    <section className="asset-metric-strip" aria-label="资产概览">
      {[
        { label: '资产总数', value: assets.length, tone: 'neutral' },
        { label: '在柜', value: assets.filter((asset) => asset.supplyMode === 'OFFICIAL' && asset.boxId !== null).length, tone: 'primary' },
        { label: '租赁中', value: assets.filter((asset) => asset.availabilityStatus === 'RENTING').length, tone: 'success' },
        { label: '个人资产待审核', value: assets.filter((asset) => asset.supplyMode === 'C2C' && asset.reviewStatus === 'PENDING').length, tone: 'warning' },
        { label: '异常', value: assets.filter((asset) => ['MAINTENANCE', 'FROZEN', 'RETIRED'].includes(asset.availabilityStatus)).length, tone: 'danger' },
      ].map((metric) => <div key={metric.label} className={`asset-metric-strip__item asset-metric-strip__item--${metric.tone}`}><span><i aria-hidden="true" />{metric.label}</span><strong>{metric.value}</strong></div>)}
    </section>
    <AdminListPanel
      className="asset-list-table"
      density="media"
      title="资产清单"
      count={filtered.length}
      countLabel="台"
      filters={(
        <ListFilterBar className="asset-filter-bar" ariaLabel="资产筛选" actions={<Button size="small" variant="outline" onClick={list.resetFilters}>重置</Button>}>
          <ListFilterField label="关键词" wide><Input clearable placeholder="资产名、编号、设备标识" value={list.get('keyword')} onChange={(value) => list.setFilters({ keyword: value })} /></ListFilterField>
          <ListFilterField label="来源"><Select clearable placeholder="全部来源" options={[{ label: '官方资产', value: 'OFFICIAL' }, { label: '用户发布', value: 'C2C' }]} value={supply} onChange={(value) => list.setFilters({ supply: value == null ? null : String(value) })} /></ListFilterField>
          <ListFilterField label="在柜状态"><Select clearable placeholder="全部" options={[{ label: '在柜', value: 'IN_CABINET' }, { label: '不在柜', value: 'OUT_OF_CABINET' }, { label: '不适用', value: 'NA' }]} value={presence} onChange={(value) => list.setFilters({ presence: value == null ? null : String(value) })} /></ListFilterField>
          <ListFilterField label="租赁状态"><Select clearable placeholder="全部" options={availabilityOptions} value={availability} onChange={(value) => list.setFilters({ availability: value == null ? null : String(value) })} /></ListFilterField>
          <ListFilterField label="所在柜机"><Select clearable placeholder="全部" options={cabinetDirectory.data?.cabinets.map((cabinet) => ({ label: cabinet.name, value: cabinet.id })) ?? []} value={cabinetId} disabled={cabinetDirectory.isError || !services.cabinetManagement} onChange={(value) => list.setFilters({ cabinetId: value == null ? null : String(value) })} /></ListFilterField>
          <ListFilterField label="业务状态"><Select clearable placeholder="全部" options={[{ label: '已上架', value: 'ONLINE' }, { label: '已下架', value: 'OFFLINE' }, { label: '待审核', value: 'PENDING' }, { label: '已通过', value: 'APPROVED' }, { label: '已驳回', value: 'REJECTED' }]} value={businessStatus} onChange={(value) => list.setFilters({ businessStatus: value == null ? null : String(value) })} /></ListFilterField>
        </ListFilterBar>
      )}
      pagination={<ListPagination current={page.current} pageSize={page.pageSize} total={page.total} onChange={(current, pageSize) => list.update({ assetPage: current, assetPageSize: pageSize })} ariaLabel="资产分页" />}
    >
      {workspace !== undefined && (cabinetDirectory.isError || !services.cabinetManagement) ? <Alert theme="error" closeBtn={false} message={<Space>柜机位置读取失败，不能核对在柜资产的格口编号。{cabinetDirectory.isError ? <Button size="small" variant="outline" onClick={() => void cabinetDirectory.refetch()}>重新读取</Button> : null}</Space>} /> : null}
      {workspaceQuery.isError ? <AdminAsyncState kind={classifyAdminAsyncError(workspaceQuery.error)} title="资产列表加载失败" actionLabel="重新加载" onAction={() => void workspaceQuery.refetch()} /> : <Table rowKey="id" data={page.rows} columns={columns} loading={workspaceQuery.isLoading} hover tableLayout="fixed" empty="暂无符合条件的资产" />}
    </AdminListPanel>

    <AdminFormDrawer visible={reviewAsset !== null} title="审核个人发布资产" description="只核对发布人提交的最新待审核版本；后台只决定通过或驳回，不修改价格。" confirmText={reviewDecision === 'APPROVE' ? '确认通过' : '确认驳回'} form={reviewController} values={{ decision: reviewDecision, reviewReason }} size="complex" pending={reviewMutation.isPending} dirty={reviewReason.trim() !== ''} onCancel={closeReview} onSubmit={async () => {
      if (!reviewAsset || reviewAsset.supplyMode !== 'C2C' || reviewAsset.reviewStatus !== 'PENDING' || !reviewAsset.latestRevisionId) throw new Error('待审核版本不完整，请刷新资产列表。');
      await reviewMutation.mutateAsync({ assetId: reviewAsset.id, expectedRevisionId: reviewAsset.latestRevisionId, decision: reviewDecision, reviewRemark: reviewReason.trim() });
    }}>
      {reviewAsset?.reviewBlockedReasons?.length ? <Alert theme="warning" closeBtn={false} message={`当前审核动作受阻：${reviewAsset.reviewBlockedReasons.join('、')}`} /> : null}
      <FormSection title="发布版本核对" description="审核前确认设备实拍、唯一标识、成色和发布人设置的出租条件。并发改稿会由服务端版本校验拒绝。"><FormGrid>
        <Form.FormItem label="资产 / 版本"><Input readonly value={`${reviewAsset?.assetNo ?? '—'} · ${reviewAsset?.latestRevisionId ?? '—'}`} /></Form.FormItem>
        <Form.FormItem label="设备唯一标识"><Input readonly value={reviewAsset?.identifierValue ?? '—'} /></Form.FormItem>
        <Form.FormItem label="资产名称"><Input readonly value={reviewAsset?.displayName ?? '—'} /></Form.FormItem>
        <Form.FormItem label="成色"><Input readonly value={reviewAsset?.condition ?? '—'} /></Form.FormItem>
        <Form.FormItem label="日租金"><Input readonly value={reviewAsset ? formatFenExact(reviewAsset.unitPriceFenRaw ?? reviewAsset.unitPriceFen) : '—'} /></Form.FormItem>
        <Form.FormItem label="押金"><Input readonly value={reviewAsset ? formatFenExact(reviewAsset.depositFenRaw ?? reviewAsset.depositFen) : '—'} /></Form.FormItem>
        <Form.FormItem label="最低租期"><Input readonly value={reviewAsset ? `${reviewAsset.minimumUnits} ${reviewAsset.rentalType === 'DAY' ? '天' : '小时'}` : '—'} /></Form.FormItem>
        <Form.FormItem label="参考价值"><Input readonly value={reviewAsset ? formatFenExact(reviewAsset.referenceValueFenRaw ?? reviewAsset.referenceValueFen) : '—'} /></Form.FormItem>
        <Form.FormItem className="admin-form-grid__full" label="瑕疵说明"><Input readonly value={reviewAsset?.defectDescription || '无'} /></Form.FormItem>
        <Form.FormItem className="admin-form-grid__full" label="随附配件"><Input readonly value={reviewAsset?.accessoryDescription || '无'} /></Form.FormItem>
        <Form.FormItem className="admin-form-grid__full" label="设备实拍"><div className="asset-media-gallery">{reviewAsset?.imageMediaIds.map((mediaId, index) => <article key={mediaId} className="asset-media-gallery__item"><MediaThumbnail mediaRef={mediaId} alt={`待审核设备图片 ${index + 1}`} size="detail" /><span>{index === 0 ? '封面' : `图片 ${index + 1}`}</span></article>)}{reviewAsset?.videoMediaIds.map((mediaId, index) => <MediaVideoPreview key={mediaId} mediaRef={mediaId} label={"播放设备视频 " + (index + 1)} className="asset-media-gallery__item asset-media-gallery__video" />)}</div></Form.FormItem>
      </FormGrid></FormSection>
      <FormSection title="发布位置核对" description="发布时地址可为空；客户端实时定位未经验证。敏感资料仅在授权后临时展开，不保存到页面查询缓存。"><FormGrid>
        <Form.FormItem className="admin-form-grid__full" label="私密位置"><PermissionGate permission={permissions.memberSensitiveRead}><Button size="small" variant="outline" loading={privateDetailsBusy} onClick={() => void readPrivateDetails()}>临时查看发布位置</Button></PermissionGate>{privateDetails ? <div>{privateDetails.publicationAddress ? <><p>{[privateDetails.publicationAddress.provinceName, privateDetails.publicationAddress.cityName, privateDetails.publicationAddress.districtName, privateDetails.publicationAddress.detailAddress].filter(Boolean).join(' ')}</p><p>{privateDetails.publicationAddress.recipientName} · {privateDetails.publicationAddress.phone}</p></> : <p>发布时未提供交付地址</p>}{privateDetails.publicationPosition ? <p>发布时定位（未验证）：{privateDetails.publicationPosition.latitude}, {privateDetails.publicationPosition.longitude}</p> : <p>发布时未取得实时定位</p>}<p>交付方式：{privateDetails.deliveryMethods.map((item) => item.method).join('、') || '—'}</p></div> : null}</Form.FormItem>
      </FormGrid></FormSection>
      <FormSection title="审核决定"><FormGrid>
        <Form.FormItem name="decision" label="决定" rules={[{ required: true, message: '请选择审核决定' }]}><Select value={reviewDecision} options={[{ label: '通过', value: 'APPROVE' }, { label: '驳回', value: 'REJECT' }]} onChange={(value) => setReviewDecision(String(value) as 'APPROVE' | 'REJECT')} /></Form.FormItem>
        <Form.FormItem className="admin-form-grid__full" name="reviewReason" label="审核原因" rules={[{ required: true, whitespace: true, message: '请填写审核原因' }]}><Textarea autosize={{ minRows: 3, maxRows: 6 }} value={reviewReason} onChange={setReviewReason} placeholder="说明核对结论或需要发布人修改的内容" /></Form.FormItem>
      </FormGrid></FormSection>
    </AdminFormDrawer>

    <AdminFormDrawer visible={batchOpen} title="新增官方资产" description="一次录入一台设备，RFID 可暂不填写；资产编号由系统生成。" confirmText="创建资产" form={batchController} values={batchDrawerValues} size="complex" pending={batchMutation.isPending} submitBlocked={mediaBlocked} dirty={JSON.stringify(batchForm) !== JSON.stringify(initialBatchForm)} onCancel={() => setBatchOpen(false)} onSubmit={() => batchMutation.mutateAsync().then(() => undefined)}>
      <FormSection title="商品与出租方" description="先选择标准商品与实际出租方，商品名称会作为资产对外名称的默认值。"><FormGrid>
        <Form.FormItem name="productId" label="标准商品" rules={[{ required: true, message: '请选择标准商品' }]}><Select filterable options={(workspace?.products ?? []).filter((product) => product.status === 'ACTIVE').map((product) => ({ label: `${product.brand} ${product.model} · ${product.name}`, value: product.id }))} value={batchForm.productId} onChange={(productId) => { const product = workspace?.products.find((candidate) => candidate.id === String(productId)); setBatchForm((value) => ({ ...value, productId: String(productId), displayName: value.displayName || product?.name || '' })); }} /></Form.FormItem>
        <Form.FormItem label="出租方"><div><Input readonly value={officialLessor?.displayName ?? '官方（由服务端固定并校验）'} /></div></Form.FormItem>
        <Form.FormItem className="admin-form-grid__full" name="displayName" label="资产对外名称" rules={[{ required: true, whitespace: true, message: '请输入资产名称' }]}><Input value={batchForm.displayName} onChange={(displayName) => setBatchForm((value) => ({ ...value, displayName }))} /></Form.FormItem>
        <Form.FormItem className="admin-form-grid__full" name="rfidCode" label="RFID（选填）" help="一台资产仅录入一个 RFID；填写时必须为 8 位十六进制字符（0–9、A–F），前导零会保留；00000000 为空位标记，不可绑定。" rules={[{ pattern: /^(?:(?!00000000$)[0-9A-Fa-f]{8})?$/, message: '请输入 8 位十六进制 RFID；00000000 不可绑定' }]}><Input value={batchForm.rfidCode} maxlength={8} onChange={(rfidCode) => setBatchForm((value) => ({ ...value, rfidCode }))} placeholder="例如 1937D715" /></Form.FormItem>
      </FormGrid></FormSection>
      <FormSection title="设备说明"><FormGrid>
        <Form.FormItem name="condition" label="成色" rules={[{ required: true, whitespace: true, message: '请输入成色' }]}><Input value={batchForm.condition} onChange={(condition) => setBatchForm((value) => ({ ...value, condition }))} /></Form.FormItem>
        <Form.FormItem name="defectDescription" label="瑕疵说明（选填）"><Input value={batchForm.defectDescription} onChange={(defectDescription) => setBatchForm((value) => ({ ...value, defectDescription }))} /></Form.FormItem>
        <Form.FormItem className="admin-form-grid__full" name="accessoryDescription" label="配件说明（选填）"><Input value={batchForm.accessoryDescription} onChange={(accessoryDescription) => setBatchForm((value) => ({ ...value, accessoryDescription }))} placeholder="例如：原装电池、充电器、机身盖" /></Form.FormItem>
      </FormGrid></FormSection>
      <FormSection title="设备实拍" description="上传当前这一台资产的图片和视频；首张图片作为资产封面。"><FormGrid>
        <Form.FormItem className="admin-form-grid__full" name="images" label="设备图片" rules={[{ required: true, message: '至少上传 1 张真实设备图片' }]}><MediaUploadField kind="image" max={6} materialClass="RENTAL_ASSET_IMAGE" ownerId={session.accountId} active={batchOpen} onStateChange={(state) => setImagesBlocked(state.blocked)} label="上传设备图片" value={batchForm.images} onChange={(images) => setBatchForm((value) => ({ ...value, images }))} /></Form.FormItem>
        <Form.FormItem className="admin-form-grid__full" name="videos" label="设备视频（选填）"><MediaUploadField kind="video" max={2} materialClass="RENTAL_ASSET_VIDEO" ownerId={session.accountId} active={batchOpen} onStateChange={(state) => setVideosBlocked(state.blocked)} label="上传设备视频" value={batchForm.videos} onChange={(videos) => setBatchForm((value) => ({ ...value, videos }))} /></Form.FormItem>
      </FormGrid></FormSection>
      <FormSection title="当前租赁条件" description="这些字段属于每台资产；后续修改会新增内部条件版本，历史订单仍读取下单快照。"><FormGrid>
        <Form.FormItem name="rentalType" label="租赁模式" rules={[{ required: true, message: '请选择租赁模式' }]}><Select options={[{ label: '按天', value: 'DAY' }, { label: '按小时', value: 'HOUR' }]} value={batchForm.rentalType} onChange={(rentalType) => setBatchForm((value) => ({ ...value, rentalType: String(rentalType) as RentalType }))} /></Form.FormItem>
        <Form.FormItem name="minimumUnits" label="最低租期" rules={[{ required: true, number: true, min: 1, message: '最低租期必须大于 0' }]}><InputNumber min={1} decimalPlaces={0} suffix={batchForm.rentalType === 'DAY' ? '天' : '小时'} value={batchForm.minimumUnits} onChange={(minimumUnits) => setBatchForm((value) => ({ ...value, minimumUnits: Number(minimumUnits) }))} /></Form.FormItem>
        <Form.FormItem name="unitPriceFen" label={batchForm.rentalType === 'DAY' ? '日租金' : '小时租金'} rules={[{ required: true, number: true, min: 0.01, message: '租金必须大于 0 元' }]}><InputNumber min={0.01} decimalPlaces={2} suffix="元" value={batchForm.unitPriceFen / 100} onChange={(unitPriceYuan) => setBatchForm((value) => ({ ...value, unitPriceFen: Math.round(Number(unitPriceYuan) * 100) }))} /></Form.FormItem>
        <Form.FormItem name="depositFen" label="押金" rules={[{ required: true, number: true, min: 0, message: '押金不能小于 0 元' }]}><InputNumber min={0} decimalPlaces={2} suffix="元" value={batchForm.depositFen / 100} onChange={(depositYuan) => setBatchForm((value) => ({ ...value, depositFen: Math.round(Number(depositYuan) * 100) }))} /></Form.FormItem>
        <Form.FormItem name="referenceValueFen" label="商品价值" rules={[{ required: true, number: true, min: 0, message: '商品价值不能小于 0 元' }]}><InputNumber min={0} decimalPlaces={2} suffix="元" value={batchForm.referenceValueFen / 100} onChange={(referenceValueYuan) => setBatchForm((value) => ({ ...value, referenceValueFen: Math.round(Number(referenceValueYuan) * 100) }))} /></Form.FormItem>
      </FormGrid></FormSection>
    </AdminFormDrawer>

    <AssetStockingDrawer
      asset={stockingAsset}
      onCancel={() => setStockingAsset(null)}
      onPlaced={async () => {
        await invalidateAssets();
        setStockingAsset(null);
        await MessagePlugin.success('资产已入柜，仍未上架；请点击上架后对外开放。');
      }}
    />

  </div>;
}
