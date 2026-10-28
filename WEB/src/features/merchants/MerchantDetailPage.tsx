import { AdminRouteLink as Link } from '../../shared/ui/AdminRouteLink';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Form, MessagePlugin, Space } from 'tdesign-react';
import { permissions, useSession } from '../../shared/access/session';
import { useCommandSingleFlight } from '../../shared/commands/useCommandSingleFlight';
import { formatUTC } from '../../shared/format/time';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { useAdminServices } from '../../shared/services';
import { PageHeader } from '../../shared/ui/PageHeader';
import { DetailDefinitionList, DetailSurface } from '../../shared/ui/DetailSurface';
import { StatusTag } from '../../shared/ui/StatusTag';
import { MediaThumbnail } from '../../shared/ui/MediaThumbnail';
import { MediaUploadField } from '../../shared/ui/MediaUploadField';
import { AdminFormDrawer } from '../../shared/ui/AdminFormDrawer';
import { mediaRefsFromUploads, type StagedMediaFile } from '../../shared/media/demoMedia';
import { PermissionGate } from '../../shared/access/PermissionGate';
import './merchants.css';

export function MerchantDetailPage() {
  const { accountId } = useSession();
  const { merchantId = '' } = useParams<{ merchantId: string }>();
  return <MerchantDetailPageContent key={(accountId ?? 'anonymous') + ':' + merchantId} />;
}
function MerchantDetailPageContent() {
  const [incomeMonth] = useState(() => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7));
  const services = useAdminServices();
  const commands = useCommandSingleFlight();
  const queryClient = useQueryClient();
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photos, setPhotos] = useState<StagedMediaFile[]>([]);
  const [photosBlocked, setPhotosBlocked] = useState(false);
  const [photoInitialized, setPhotoInitialized] = useState(false);
  const photoForm = Form.useForm()[0]!;
  const queryKeys = useAdminQueryKeys();
  const session = useSession();
  const navigate = useNavigate();
  const { merchantId = '' } = useParams<{ merchantId: string }>();
  
  const canViewCabinets = session.hasPermission(permissions.cabinetView);
  const apiMode = services.merchants.search !== undefined;
  const merchantQuery = useQuery({
    queryKey: queryKeys.resource('merchants', 'detail', merchantId),
    enabled: merchantId !== '',
    queryFn: async ({ signal }) => {
      if (apiMode) return { merchant: await services.merchants.getById(merchantId, { signal }), cabinets: [] };
      const [merchant, cabinets] = await Promise.all([
        services.merchants.getById(merchantId, { signal }),
        services.cabinets.list({ signal }),
      ]);
      return {
        merchant,
        cabinets: cabinets.filter((cabinet) => cabinet.merchantId === merchantId),
      };
    },
  });
  const cabinetsQuery = useQuery({
    queryKey: queryKeys.resource('cabinets', 'merchant', merchantId),
    enabled: apiMode && merchantId !== '' && canViewCabinets && services.cabinetManagement !== undefined,
    queryFn: ({ signal }) => services.cabinetManagement!.list({ merchantId }, { signal }),
  });

const photoMutation = useMutation({
    mutationFn: async () => {
      if (photosBlocked) throw new Error('请先完成或移除待处理商家图片');
      const current = merchantQuery.data?.merchant;
      if (!current?.version || !services.merchants.updatePhotos) throw new Error('商家版本或图片编辑能力不可用');
      return commands.run(current.id, 'update-photos', (command) => services.merchants.updatePhotos!(current.id, current.version!, mediaRefsFromUploads(photos, session.apiMode), command.idempotencyKey));
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.domain('merchants') }); setPhotoOpen(false); setPhotoInitialized(false); await MessagePlugin.success('商家图片已更新'); },
    onError: async (error) => MessagePlugin.error(error instanceof Error ? error.message : '图片更新结果不明，请刷新核对'),
  });

if (merchantQuery.isLoading) return <div><PageHeader title="商家详情" /><Card className="data-card">正在加载商家信息…</Card></div>;
  if (merchantQuery.isError || merchantQuery.data === undefined) return (
    <div>
      <PageHeader title="商家详情" actions={<Button variant="outline" onClick={() => navigate('/merchants')}>返回商家列表</Button>} />
      <Alert theme="error" closeBtn={false} message={<Space>商家详情加载失败<Button size="small" variant="outline" onClick={() => void merchantQuery.refetch()}>重新加载</Button></Space>} />
    </div>
  );
  const { merchant, cabinets } = merchantQuery.data;
  return (
    <div>
      <PageHeader title={merchant.name} description="回显商家主档、经营地址、图片与关联柜机。" actions={<Space><StatusTag value={merchant.status} />{session.permissions.includes('ops.finance.read') ? <Link to={`/finance?tab=earnings&beneficiary_kind=MERCHANT&merchant_id=${encodeURIComponent(merchant.id)}&period_month=${incomeMonth}`}>查看该商家收益流水</Link> : null}<Button variant="outline" onClick={() => navigate('/merchants')}>返回商家列表</Button></Space>} />
      <div className="detail-grid merchant-detail-grid">
        <DetailSurface title={`商家图片 (${merchant.photoMaterialIds?.length ?? 0}/9)`}>
          <PermissionGate permission={permissions.merchantManage}><Button size="small" variant="outline" onClick={() => { if (!photoInitialized) setPhotos((merchant.photoMaterialIds ?? []).map((materialId) => ({ id: materialId, materialId, name: materialId, mimeType: 'image/jpeg', size: 0, dataUrl: '' }))); setPhotoInitialized(true); setPhotoOpen(true); }}>编辑图片</Button></PermissionGate>
          {(merchant.photoMaterialIds?.length ?? 0) === 0 ? <p>暂未上传商家图片</p> : <div className="merchant-photo-gallery">{merchant.photoMaterialIds?.map((materialId, index) => <div key={materialId}><MediaThumbnail mediaRef={materialId} alt={`${merchant.name}图片 ${index + 1}`} size="detail" /><span>{index === 0 ? '封面' : `图片 ${index + 1}`}</span></div>)}</div>}
        </DetailSurface>
        <DetailSurface title="合作信息">
          <DetailDefinitionList className="merchant-detail-list">
            <div><dt>联系人</dt><dd>{merchant.contactName}</dd></div>
            <div><dt>联系电话</dt><dd>{merchant.phoneDial || '—'}</dd></div>
            <div><dt>默认分润比例</dt><dd>{(merchant.shareBps / 100).toFixed(2)}%</dd></div>
            <div><dt>结算周期</dt><dd>自然月；次月线下统计打款</dd></div>
            <div><dt>结算账户</dt><dd>{merchant.settlementAccount}</dd></div>
            <div><dt>关联柜机</dt><dd>{apiMode ? merchant.cabinetCount ?? '—' : cabinets.length} 台</dd></div>
            
          </DetailDefinitionList>
        </DetailSurface>
        <DetailSurface title="经营地址">
          <DetailDefinitionList className="merchant-detail-list">
            <div className="merchant-detail-list__wide"><dt>完整地址</dt><dd>{merchant.operatingAddress.fullAddress}</dd></div>
            <div><dt>地图确认</dt><dd>{merchant.operatingAddress.confirmationStatus}</dd></div>
            <div><dt>GCJ-02 坐标</dt><dd className="mono-value">{merchant.operatingAddress.longitude.toFixed(6)}, {merchant.operatingAddress.latitude.toFixed(6)}</dd></div>
            <div><dt>创建时间</dt><dd>{formatUTC(merchant.createdAt)}</dd></div>
            <div><dt>最近更新</dt><dd>{formatUTC(merchant.updatedAt)}</dd></div>
          </DetailDefinitionList>
        </DetailSurface>
      </div>
      <AdminFormDrawer visible={photoOpen} title="编辑商家图片" description="经营地址保持原记录；最多 9 张，首张为封面。" confirmText="保存图片" form={photoForm} values={{ photos }} pending={photoMutation.isPending} submitBlocked={photosBlocked} dirty={JSON.stringify(mediaRefsFromUploads(photos)) !== JSON.stringify(merchant.photoMaterialIds ?? [])} onCancel={() => setPhotoOpen(false)} onSubmit={() => photoMutation.mutateAsync().then(() => undefined)}>
        <Form.FormItem name="photos" label="商家图片"><MediaUploadField kind="image" materialClass="MERCHANT_IMAGE" ownerId={session.accountId} active={photoOpen} onStateChange={(state) => setPhotosBlocked(state.blocked)} max={9} allowReorder label="上传商家图片" value={photos} onChange={setPhotos} /></Form.FormItem>
      </AdminFormDrawer>
      <DetailSurface title={`关联租赁柜 (${apiMode ? cabinetsQuery.data?.statistics.total ?? merchant.cabinetCount ?? 0 : cabinets.length})`}>
        {!canViewCabinets && apiMode ? <Alert theme="warning" closeBtn={false} message="当前角色无租赁柜读取权限，关联柜机已隐藏。" /> : null}
        {canViewCabinets && apiMode && cabinetsQuery.isError ? <Alert theme="error" closeBtn={false} message={<Space>关联柜机加载失败<Button size="small" variant="outline" onClick={() => void cabinetsQuery.refetch()}>重新加载</Button></Space>} /> : null}
        {canViewCabinets && apiMode && !cabinetsQuery.isError ? <div className="merchant-cabinet-list">
          {(cabinetsQuery.data?.items ?? []).map((cabinet) => <Card key={cabinet.cabinet_id} title={cabinet.cabinet_name} actions={<StatusTag value={cabinet.lifecycle_status} />}>
            <div className="table-primary"><strong className="mono-value">{cabinet.provider_device_id}</strong><small>{cabinet.deployment_site_address ?? '商家经营地址未配置'}</small><small>{cabinet.occupancy_summary.occupied} 已占用 / {cabinet.occupancy_summary.available} 可用 / {cabinet.occupancy_summary.current} 当前格口</small></div>
          </Card>)}
          {!cabinetsQuery.isLoading && (cabinetsQuery.data?.items.length ?? 0) === 0 ? <p>当前商家暂无关联租赁柜。</p> : null}
        </div> : null}
        {!apiMode ? <p>当前关联 {cabinets.length} 台柜机。</p> : null}
      </DetailSurface>
      
    </div>
  );
}
