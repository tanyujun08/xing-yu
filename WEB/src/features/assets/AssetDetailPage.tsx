import { AdminRouteLink as Link } from '../../shared/ui/AdminRouteLink';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Form, Input, MessagePlugin, Space, Table, Tag, type PrimaryTableCol } from 'tdesign-react';
import { PermissionGate } from '../../shared/access/PermissionGate';
import { useCommandSingleFlight } from '../../shared/commands/useCommandSingleFlight';
import { permissions, useSession } from '../../shared/access/session';
import { formatFenExact } from '../../shared/format/money';
import { formatUTC } from '../../shared/format/time';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { useAdminServices, type AssetRentalTermsRevision } from '../../shared/services';
import { AdminTabPanel, AdminTabs } from '../../shared/ui/AdminTabs';
import { AdminFormDrawer } from '../../shared/ui/AdminFormDrawer';
import { DetailDefinitionList, DetailEmptyState, DetailPageSummary, DetailSurface, DetailTraceRail } from '../../shared/ui/DetailSurface';
import { StatusTag } from '../../shared/ui/StatusTag';
import { MediaThumbnail } from '../../shared/ui/MediaThumbnail';
import { MediaVideoPreview } from '../../shared/ui/MediaVideoPreview';
import { readAssetCabinetLocation, unplacedAssetLocation } from './assetCabinetLocation';
import { readAssetAudit } from './assetAudit';
import { publicationBlockerMessages } from './assetPublication';
import { AssetPublicationAction } from './AssetPublicationAction';
import { AssetStockingDrawer } from './AssetStockingDrawer';
import { AssetCabinetRemovalDrawer } from './AssetCabinetRemovalDrawer';
import { AssetEditDrawer } from './AssetEditDrawer';
import './assets.css';

export function AssetDetailPage() {
  const services = useAdminServices();
  const session = useSession();
  const queryClient = useQueryClient();
  const queryKeys = useAdminQueryKeys();
  const commands = useCommandSingleFlight();
  const navigate = useNavigate();
  const { assetId = '' } = useParams<{ assetId: string }>();
  const [activeTab, setActiveTab] = useState('overview');
  const [rfidOpen, setRFIDOpen] = useState(false);
  const [rfidInput, setRFIDInput] = useState('');
  const [stockingOpen, setStockingOpen] = useState(false);
  const [removalOpen, setRemovalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const rfidForm = Form.useForm()[0]!;
  const query = useQuery({
    queryKey: queryKeys.resource('assets', 'detail', assetId),
    enabled: assetId !== '',
    queryFn: async ({ signal }) => {
      const [assets, products, lessors, terms] = await Promise.all([services.assets.list({ signal }), services.catalog.listProducts({ signal }), services.assets.listLessors({ signal }), services.assets.listTerms(assetId, { signal })]);
      return { asset: assets.find((asset) => asset.id === assetId), products, lessors, terms };
    },
  });
  const asset = query.data?.asset;
  const rfidMutation = useMutation({
    mutationFn: async () => {
      if (!asset || !asset.version || !services.assets.updateRFID) throw new Error('资产版本或 RFID 编辑能力不可用');
      if (rfidInput !== '' && !/^(?!00000000$)[0-9A-Fa-f]{8}$/.test(rfidInput)) throw new Error('RFID 必须为 8 位十六进制字符（0–9、A–F）；00000000 为空位标记，不可绑定');
      if ((asset.rfidCode ?? '') === rfidInput) return asset;
      return commands.run(asset.id, 'update-rfid', (command) => services.assets.updateRFID!(asset.id, asset.version!, rfidInput.toUpperCase() || null, command.idempotencyKey));
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.domain('assets') }); setRFIDOpen(false); await MessagePlugin.success('RFID 已更新'); },
    onError: async (error) => MessagePlugin.error(error instanceof Error ? error.message : 'RFID 更新结果不明，请刷新资产后核对'),
  });
  const cabinetId = asset?.cabinetId ?? '';
  const compartmentId = asset?.boxId ?? '';
  const cabinetLocation = useQuery({
    queryKey: queryKeys.resource('assets', 'cabinet-location', cabinetId, compartmentId),
    enabled: asset?.supplyMode === 'OFFICIAL' && compartmentId !== '' && cabinetId !== '' && services.cabinetManagement !== undefined,
    queryFn: ({ signal }) => readAssetCabinetLocation(services.cabinetManagement!, cabinetId, compartmentId, signal),
    retry: false,
  });
  const canViewAudit = session.permissions.includes('ops.audit.read');
  const audit = useQuery({
    queryKey: queryKeys.resource('assets', 'audit', assetId),
    enabled: assetId !== '' && activeTab === 'audit' && canViewAudit && services.iam !== undefined,
    queryFn: ({ signal }) => readAssetAudit(services.iam!, assetId, signal),
    retry: false,
  });
  const product = query.data?.products.find((candidate) => candidate.id === asset?.productId);
  const lessor = query.data?.lessors.find((candidate) => candidate.id === asset?.lessorId);
  const terms = useMemo(() => Array.from(query.data?.terms ?? []), [query.data?.terms]);

  if (query.isLoading) return <DetailEmptyState>正在读取资产详情…</DetailEmptyState>;
  if (query.isError) return <Alert theme="error" closeBtn={false} message={<Space>资产详情加载失败<Button size="small" variant="outline" onClick={() => void query.refetch()}>重新加载</Button></Space>} />;
  if (asset === undefined) return <DetailEmptyState>资产不存在或已不可读取</DetailEmptyState>;

  const imageMediaIds = [...new Set([asset.coverMediaId, ...asset.imageMediaIds].filter((mediaId): mediaId is string => mediaId !== null))];
  const locationLabel = asset.supplyMode === 'C2C'
    ? asset.publishLocationSnapshot?.fullAddress ?? '未填写发布位置'
    : asset.boxId === null ? unplacedAssetLocation(asset) : cabinetLocation.data?.cabinetBox ?? (cabinetId === '' || !services.cabinetManagement || cabinetLocation.isError ? '柜机格口读取失败' : '正在读取柜机格口…');

  const termsColumns: PrimaryTableCol<AssetRentalTermsRevision>[] = [
    { colKey: 'revision', title: '版本', width: 80, cell: ({ row }) => `v${row.revision}` },
    { colKey: 'effectiveAt', title: '生效时间', width: 180, cell: ({ row }) => formatUTC(row.effectiveAt) },
    { colKey: 'rent', title: '租赁价格', width: 180, cell: ({ row }) => `${formatFenExact(row.unitPriceFenRaw ?? row.unitPriceFen)} / ${row.rentalType === 'DAY' ? '天' : '小时'}，最低 ${row.minimumUnits}` },
    { colKey: 'deposit', title: '押金 / 价值', width: 190, cell: ({ row }) => `${formatFenExact(row.depositFenRaw ?? row.depositFen)} / ${formatFenExact(row.referenceValueFenRaw ?? row.referenceValueFen)}` },
    { colKey: 'reason', title: '变更原因', cell: ({ row }) => row.changeReason },
  ];
  const auditColumns: PrimaryTableCol<Awaited<ReturnType<typeof readAssetAudit>>[number]>[] = [
    { colKey: 'occurred_at', title: '时间', width: 180, cell: ({ row }) => formatUTC(row.occurred_at) },
    { colKey: 'action_code', title: '动作', width: 220 },
    { colKey: 'actor_account_id', title: '操作人', width: 180 },
    { colKey: 'result_code', title: '结果', width: 120 },
    { colKey: 'field_change_summary', title: '变更摘要', cell: ({ row }) => JSON.stringify(row.field_change_summary) },
  ];

  return <div>
    {asset.publishStatus === 'OFFLINE' && asset.publicationBlockers?.length ? <Alert theme="warning" closeBtn={false} message={`当前不能上架：${publicationBlockerMessages(asset.publicationBlockers).join('；')}`} /> : null}
    <DetailPageSummary
      className="asset-detail-summary"
      media={<MediaThumbnail mediaRef={asset.coverMediaId} alt={`${asset.displayName}封面`} size="detail" />}
      eyebrow={<Tag theme={asset.supplyMode === 'OFFICIAL' ? 'primary' : 'success'} variant="light">{asset.supplyMode === 'OFFICIAL' ? '官方资产' : '用户发布'}</Tag>}
      title={asset.displayName}
      description={product === undefined ? '未关联标准商品' : `${product.brand} ${product.model} · ${product.name}`}
      statuses={<><StatusTag value={asset.publishStatus} label={asset.publishStatus === 'ONLINE' ? '已上架' : '未上架'} /><StatusTag value={asset.availabilityStatus} />{asset.supplyMode === 'C2C' ? <StatusTag value={asset.reviewStatus} /> : null}{asset.supplyMode === 'OFFICIAL' ? <Tag size="small" theme={asset.boxId === null ? 'warning' : 'success'} variant="light">{asset.boxId === null ? '不在柜' : '在柜'}</Tag> : null}</>}
      trace={<DetailTraceRail items={[
        { label: '资产编号', value: asset.assetNo, mono: true },
        { label: '设备唯一标识', value: asset.identifierValue, mono: true },
        { label: '当前位置', value: locationLabel },
      ]} />}
      metric={<><span>当前租金</span><strong>{formatFenExact(asset.unitPriceFenRaw ?? asset.unitPriceFen)} / {asset.rentalType === 'DAY' ? '天' : '小时'}</strong></>}
      actions={<Space breakLine>
        {asset.supplyMode === 'OFFICIAL' ? <PermissionGate permission={permissions.assetManage}>
          <Button variant="outline" disabled={asset.availabilityStatus === 'RETIRED' || !asset.version} onClick={() => setEditOpen(true)}>编辑资产</Button>
          <AssetPublicationAction asset={asset} variant="outline" size="medium" />
          {services.cabinetManagement && asset.boxId === null && asset.publishStatus === 'OFFLINE' && asset.availabilityStatus === 'AVAILABLE' ? <PermissionGate permission={permissions.cabinetManage}><Button tag="button" theme="primary" onClick={() => setStockingOpen(true)}>资产入柜</Button></PermissionGate> : null}
          {services.cabinetManagement && asset.boxId !== null ? <Button tag="button" variant="outline" disabled={asset.publishStatus !== 'OFFLINE' || asset.availabilityStatus !== 'AVAILABLE' || asset.placement?.location_kind !== 'CABINET' || !asset.placement.placement_id || !asset.placement.version} title={asset.publishStatus !== 'OFFLINE' ? '请先下架资产，再进行出柜' : asset.availabilityStatus !== 'AVAILABLE' ? '资产当前不可用，暂不能出柜' : asset.placement?.location_kind !== 'CABINET' || !asset.placement.placement_id || !asset.placement.version ? '在柜记录未读取，请刷新资产' : '确认资产已实际取出后解除在柜关系'} onClick={() => setRemovalOpen(true)}>资产出柜</Button> : null}
        </PermissionGate> : null}
        <Button variant="outline" onClick={() => navigate('/assets')}>返回资产列表</Button>
      </Space>}
    />
    <AdminTabs value={activeTab} onChange={(value) => setActiveTab(String(value))}>
      <AdminTabPanel value="overview" label="资产概览">
        <div className="asset-detail-sections">
          <DetailSurface title="设备身份与归属" variant="section">
            <DetailDefinitionList columns={3}>
              <div><dt>标识类型</dt><dd>{asset.identifierType}</dd></div>
              <div><dt>供应模式</dt><dd>{asset.supplyMode === 'OFFICIAL' ? '官方租赁' : 'C2C 用户发布'}</dd></div>
              <div><dt>出租方</dt><dd>{lessor?.displayName ?? asset.lessorId}</dd></div>
              {asset.supplyMode === 'OFFICIAL' ? <div><dt>RFID</dt><dd><Space>{asset.rfidCode ?? '未设置'}<PermissionGate permission={permissions.assetManage}><Button size="small" variant="text" onClick={() => { setRFIDInput(asset.rfidCode ?? ''); setRFIDOpen(true); }}>修改</Button></PermissionGate></Space></dd></div> : null}
              <div className="asset-detail-definition-list__wide"><dt>标准商品</dt><dd>{product === undefined ? '—' : `${product.brand} ${product.model} · ${product.name}`}</dd></div>
              <div><dt>成色</dt><dd>{asset.condition}</dd></div>
              <div><dt>配件说明</dt><dd>{asset.accessoryDescription || '—'}</dd></div>
              <div className="asset-detail-definition-list__wide"><dt>瑕疵说明</dt><dd>{asset.defectDescription || '—'}</dd></div>
              <div><dt>创建时间</dt><dd>{formatUTC(asset.createdAt)}</dd></div>
              <div><dt>更新时间</dt><dd>{formatUTC(asset.updatedAt)}</dd></div>
            </DetailDefinitionList>
          </DetailSurface>
          <DetailSurface title="当前租赁条件" variant="section">
            <DetailDefinitionList columns={3}>
              <div><dt>租赁模式</dt><dd>{asset.rentalType === 'DAY' ? '按天' : '按小时'}</dd></div>
              <div><dt>最低租期</dt><dd>{asset.minimumUnits} {asset.rentalType === 'DAY' ? '天' : '小时'}</dd></div>
              <div><dt>租金</dt><dd className="money-value">{formatFenExact(asset.unitPriceFenRaw ?? asset.unitPriceFen)}</dd></div>
              <div><dt>押金</dt><dd className="money-value">{formatFenExact(asset.depositFenRaw ?? asset.depositFen)}</dd></div>
              <div><dt>商品价值</dt><dd className="money-value">{formatFenExact(asset.referenceValueFenRaw ?? asset.referenceValueFen)}</dd></div>
              <div><dt>条件版本</dt><dd>v{asset.termsRevision}</dd></div>
              <div><dt>生效时间</dt><dd>{formatUTC(asset.termsEffectiveAt)}</dd></div>
            </DetailDefinitionList>
          </DetailSurface>
          <DetailSurface title="位置与在柜信息" variant="section">
            {asset.supplyMode === 'OFFICIAL' && asset.boxId !== null && (!asset.cabinetId || !services.cabinetManagement || cabinetLocation.isError) ? <Alert theme="error" closeBtn={false} message={<Space>柜机格口位置不可核实，不以内部格口 ID 代替编号。{cabinetLocation.isError ? <Button size="small" variant="outline" onClick={() => void cabinetLocation.refetch()}>重新读取</Button> : null}</Space>} /> : null}
            <DetailDefinitionList columns={3}>
              <div className="asset-detail-definition-list__wide"><dt>当前位置</dt><dd>{asset.supplyMode === 'C2C' ? asset.publishLocationSnapshot?.fullAddress ?? '—' : asset.boxId === null ? locationLabel : cabinetLocation.data?.address ?? locationLabel}</dd></div>
              <div><dt>柜机格口</dt><dd>{asset.supplyMode === 'C2C' ? '不适用' : asset.boxId === null ? '未分配' : locationLabel}</dd></div>
              <div><dt>在柜状态</dt><dd>{asset.supplyMode === 'C2C' ? <span aria-label="个人资产在柜状态不适用">不适用</span> : asset.boxId === null ? <Tag size="small" theme="warning" variant="light">不在柜</Tag> : <Tag size="small" theme="success" variant="light">在柜</Tag>}</dd></div>
            </DetailDefinitionList>
          </DetailSurface>
          <DetailSurface title="设备图片与视频" variant="section" description={`${asset.mediaSource === 'ASSET_ACTUAL' ? '资产实拍' : '沿用商品标准素材'} · ${imageMediaIds.length} 张图片 · ${asset.videoMediaIds.length} 个视频`}>
            <div className="asset-media-gallery">
              {imageMediaIds.length === 0 ? <DetailEmptyState>暂无设备图片</DetailEmptyState> : imageMediaIds.map((mediaId, index) => <article key={mediaId} className={`asset-media-gallery__item${index === 0 ? ' asset-media-gallery__item--cover' : ''}`}>
                <MediaThumbnail mediaRef={mediaId} alt={`${asset.displayName}${index === 0 ? '封面' : `实拍图 ${index + 1}`}`} size="detail" />
                <span>{index === 0 ? '封面' : `图片 ${index + 1}`}</span>
              </article>)}
              {asset.videoMediaIds.map((mediaId, index) => <MediaVideoPreview key={mediaId} mediaRef={mediaId} label={"播放设备视频 " + (index + 1)} className="asset-media-gallery__item asset-media-gallery__video" />)}
            </div>
          </DetailSurface>
        </div>
      </AdminTabPanel>
      <AdminTabPanel value="terms" label={`租赁条件版本 ${terms.length}`}><DetailSurface title="租赁条件变更记录" description="只用于追溯；订单始终读取下单时保存的不可变快照。"><Table rowKey="id" data={terms} columns={termsColumns} stripe hover empty="暂无版本记录" /></DetailSurface></AdminTabPanel>
      <AdminTabPanel value="orders" label="关联订单"><DetailSurface title="资产订单记录">{session.permissions.includes('ops.orders.read') ? <Link to={`/orders/rental?asset_id=${encodeURIComponent(asset.id)}`}>查看该资产的租赁订单</Link> : <p>当前角色没有订单读取权限。</p>}</DetailSurface></AdminTabPanel>
      <AdminTabPanel value="audit" label={`审计记录${audit.data ? ` ${audit.data.length}` : ''}`}><DetailSurface title="资产审计">
        {!canViewAudit ? <Alert theme="warning" closeBtn={false} message="当前角色没有审计读取权限。" /> : !services.iam ? <Alert theme="info" closeBtn={false} message="当前模式未接入真实审计接口，不展示演示审计。" /> : audit.isError ? <Alert theme="error" closeBtn={false} message={<Space>资产审计读取失败<Button size="small" variant="outline" onClick={() => void audit.refetch()}>重新读取</Button></Space>} /> : <Table rowKey="event_id" data={audit.data ?? []} columns={auditColumns} loading={audit.isLoading} stripe hover empty="暂无资产审计记录" />}
      </DetailSurface></AdminTabPanel>
    </AdminTabs>
    <AssetStockingDrawer asset={stockingOpen ? asset : null} onCancel={() => setStockingOpen(false)} onPlaced={async () => { setStockingOpen(false); await MessagePlugin.success('资产已入柜，仍未上架；请点击上架后对外开放'); }} />
    <AssetCabinetRemovalDrawer asset={removalOpen ? asset : null} locationLabel={locationLabel} onCancel={() => setRemovalOpen(false)} onRemoved={async () => { setRemovalOpen(false); await MessagePlugin.success('资产已出柜，取件码已撤销，格口已释放'); }} />
    {editOpen ? <AssetEditDrawer key={`${session.accountId}:${asset.id}:${asset.version}`} asset={asset} onCancel={() => setEditOpen(false)} onSaved={async () => { await Promise.all(['assets', 'cabinets', 'audit'].map(domain => queryClient.invalidateQueries({ queryKey: queryKeys.domain(domain) }))); setEditOpen(false); await MessagePlugin.success('资产新版本已保存并下架，请核对后重新上架'); }} /> : null}
    <AdminFormDrawer visible={rfidOpen} title="修改 RFID" description={`资产 ${asset.assetNo} · 系统设备标识 ${asset.identifierValue}`} confirmText="保存 RFID" form={rfidForm} values={{ rfidCode: rfidInput }} pending={rfidMutation.isPending} dirty={rfidInput !== (asset.rfidCode ?? '')} onCancel={() => setRFIDOpen(false)} onSubmit={() => rfidMutation.mutateAsync().then(() => undefined)}>
      <Form.FormItem name="rfidCode" label="RFID（选填）" help="只能填写一个 8 位十六进制 RFID；00000000 为空位标记，不可绑定。清空后解除绑定。" rules={[{ pattern: /^(?:(?!00000000$)[0-9A-Fa-f]{8})?$/, message: '请输入 8 位十六进制 RFID；00000000 不可绑定' }]}><Input maxlength={8} value={rfidInput} onChange={setRFIDInput} placeholder="例如 1937D715" /></Form.FormItem>
    </AdminFormDrawer>
  </div>;
}
