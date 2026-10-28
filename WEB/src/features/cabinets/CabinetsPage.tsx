import { randomId } from '../../shared/randomId';
import { AdminDisclosure } from '../../shared/ui/AdminDisclosure';
import { AdminTabs, AdminTabPanel } from '../../shared/ui/AdminTabs';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Checkbox,
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  MessagePlugin,
  Select,
  Space,
  Tag,
} from 'tdesign-react';
import { AddIcon, LockOffIcon, RefreshIcon, ServerIcon } from 'tdesign-icons-react';
import { useSession } from '../../shared/access/session';
import { cabinetManagementFailure, cabinetObservationSource, type ManagedCabinet, type ManagedCompartment } from '../../shared/services/cabinetManagement';
import { CabinetApiCommands } from './CabinetApiCommands';
import { CabinetCompartmentDrawer } from './CabinetCompartmentDrawer';
import { CabinetProviderOperationsPanel } from './CabinetProviderOperationsPanel';
import { CabinetInventoryPanel } from './CabinetInventoryPanel';
import { CabinetMiniProgramCode } from './CabinetMiniProgramCode';
import { CabinetStockingCreateDialog } from './CabinetStockingCreateDialog';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { formatUTC } from '../../shared/format/time';
import { useAdminServices } from '../../shared/services';
import { AdminFormDrawer } from '../../shared/ui/AdminFormDrawer';
import { AdminListPanel } from '../../shared/ui/AdminListPanel';
import { FormGrid } from '../../shared/ui/FormGrid';
import { FormSection } from '../../shared/ui/FormSection';
import { ListFilterBar, ListFilterField } from '../../shared/ui/ListFilterBar';
import { PageHeader } from '../../shared/ui/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag';
import './cabinets.css';
import { cabinetCreateInput } from './cabinetCreateInput';

export function CabinetsPage() {
  return <CabinetsApiPanel />;
}

type CabinetManagementAction = 'create' | 'update' | 'activate' | 'deactivate' | 'archive' | 'restore' | 'resize';
const managementLabels: Record<CabinetManagementAction, string> = { create: '录入租赁柜', update: '编辑租赁柜', activate: '启用租赁柜', deactivate: '停用租赁柜', archive: '归档租赁柜', restore: '恢复租赁柜', resize: '调整格口数量' };
const managementForm = { device: '', name: '', description: '', count: 1, reason: '', confirmed: false, merchantId: '', merchantLabel: '' };
function doorObservationLabel(box: ManagedCompartment): string {
  if (!box.door_observed_at) return '暂无可靠观察';
  if (box.door_status === 'UNKNOWN') return `最近查询未确认 · ${formatUTC(box.door_observed_at)}`;
  const source = cabinetObservationSource(box.door_observation_source);
  return `${formatUTC(box.door_observed_at)} · ${source}`;
}
function ManagedCabinetBoxCard({ box, onDetails }: { box: ManagedCompartment; onDetails: () => void }) {
  const occupancy = box.business_occupancy_status;
  const state = box.service_status === 'OUT_OF_SERVICE' ? 'frozen' : occupancy === 'OCCUPIED' ? 'occupied' : occupancy === 'RESERVED' ? 'reserved' : '';
  const occupant = box.occupant ?? null;
  const occupantReliable = occupancy === 'OCCUPIED' && occupant !== null;
  const occupantMismatch = occupancy === 'UNKNOWN'
    || (occupancy === 'OCCUPIED' && occupant === null)
    || (occupancy !== 'OCCUPIED' && occupant !== null);
  const titleId = `managed-cabinet-box-${box.compartment_id}`;
  const observedRFID = box.rfid_status === 'PRESENT' ? box.observed_rfid_code : box.rfid_status === 'ABSENT' ? '未检测到设备' : box.rfid_checked_at ? '待核实' : '未读取';
  return <article className={`cabinet-box${state ? ` cabinet-box--${state}` : ''} cabinet-box--door-${box.door_status.toLowerCase()}`} aria-labelledby={titleId}>
    <div className="cabinet-box-title"><div className="cabinet-box-plate"><strong id={titleId}><span>BOX</span>{String(box.compartment_no).padStart(2, '0')}</strong><span>格口 {box.compartment_no}</span></div><StatusTag value={box.service_status} /></div>
    <div className="cabinet-box-lockline"><LockOffIcon /><span>柜门</span><b>{box.door_status === 'OPEN' ? '门开' : box.door_status === 'CLOSED' ? '门关' : '状态未知'}</b></div>
    <div className="cabinet-box-asset"><ServerIcon /><span><strong>{occupantMismatch ? '占用待核查' : occupantReliable ? occupant.display_name : occupancy === 'RESERVED' ? '格口已预占' : '未登记在柜资产'}</strong>{occupantReliable && <small>{occupant.asset_no}</small>}</span></div>
    <div className="cabinet-box-asset"><span><strong>实测 RFID：{observedRFID}</strong><small title={box.rfid_checked_at ? formatUTC(box.rfid_checked_at) : undefined}>最近查询：{box.rfid_checked_at ? formatUTC(box.rfid_checked_at) : '尚未查询'}</small></span></div>
    <div className="cabinet-box__summary"><StatusTag value={occupancy} /><small>{doorObservationLabel(box)}</small></div>
    <Button size="small" variant="text" onClick={onDetails}>查看详情</Button>
  </article>;
}

// API mode stays on the existing cabinet route and UI primitives. No mock
// merchant/asset inventory, supplier outcomes or device capabilities are sent.
export function CabinetsApiPanel() {
  const session = useSession();
  const services = useAdminServices();
  const gateway = services.cabinetManagement;
  const queryClient = useQueryClient();
  const queryKeys = useAdminQueryKeys();
  const [params, setParams] = useSearchParams();
  const cursor = params.get('cabinet_cursor') ?? '';
  const selected = params.get('cabinet_id') ?? '';
  const keywordFilter = params.get('keyword') ?? '';
  const merchantFilter = params.get('merchant') ?? '';
  const lifecycleFilter = params.get('lifecycle') ?? '';
  const connectivityFilter = params.get('connectivity') ?? '';
  const occupancyFilter = params.get('occupancy') ?? '';
  const [visible, setVisible] = useState(() => !document.hidden);
  const [commandBusy, setCommandBusy] = useState(false);
  const [cabinetTab, setCabinetTab] = useState<'compartments' | 'inventory' | 'operations' | 'history'>('compartments');
  const [selectedBoxId, setSelectedBoxId] = useState('');
  const [stockingCreate, setStockingCreate] = useState(false);
  const [form, setForm] = useState(managementForm);
  const [merchantCursor, setMerchantCursor] = useState('');
  const [intent, setIntent] = useState<{ action: CabinetManagementAction; cabinet: ManagedCabinet | null; key: string } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [failure, setFailure] = useState('');
  const originalRequest = useRef<(() => Promise<ManagedCabinet>) | null>(null);
  const inFlight = useRef(false);
  const controller = Form.useForm()[0]!;
  const canRead = session.accessToken !== null && session.permissions.includes('ops.cabinets.read');
  const enabled = canRead && gateway !== undefined && visible;
  const rootKey = ['cabinet-management', session.accountId] as const;
  const merchants = useQuery({
    queryKey: [...rootKey, 'create-merchants', merchantCursor, session.permissions],
    enabled: enabled && gateway?.merchants !== undefined && session.permissions.includes('ops.merchants.read'),
    queryFn: ({ signal }) => gateway!.merchants!(merchantCursor, { signal }), retry: false,
  });
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const list = useQuery({
    queryKey: [...rootKey, 'list', cursor, keywordFilter, merchantFilter, lifecycleFilter, connectivityFilter, occupancyFilter],
    queryFn: ({ signal }) => gateway!.list({
      cursor,
      keyword: keywordFilter,
      merchantId: merchantFilter,
      lifecycle: lifecycleFilter as '' | 'INACTIVE' | 'ACTIVE' | 'ARCHIVED',
      connectivity: connectivityFilter as '' | 'UNKNOWN' | 'ONLINE' | 'OFFLINE',
      occupancy: occupancyFilter as '' | 'OCCUPIED' | 'AVAILABLE' | 'FULL',
    }, { signal }),
    enabled, retry: false,
  });
  const detail = useQuery({
    queryKey: [...rootKey, 'detail', selected], queryFn: ({ signal }) => gateway!.get(selected, { signal }),
    enabled: enabled && selected !== '', retry: false,
    refetchInterval: visible ? 30_000 : false, refetchIntervalInBackground: false, refetchOnWindowFocus: 'always',
  });
  const slots = useQuery({
    queryKey: [...rootKey, 'slots', selected], queryFn: ({ signal }) => gateway!.compartments(selected, { signal }),
    enabled: enabled && selected !== '', retry: false,
    refetchInterval: visible ? 30_000 : false, refetchIntervalInBackground: false, refetchOnWindowFocus: 'always',
  });
  const initialObservationId = detail.data?.initial_observation_command_id ?? '';
  const initialObservation = useQuery({
    queryKey: [...rootKey, 'initial-observation', initialObservationId],
    queryFn: ({ signal }) => gateway!.command(initialObservationId, { signal }),
    enabled: enabled && selected !== '' && initialObservationId !== '',
    retry: false,
    refetchInterval: (query) => visible && query.state.data?.resolution_status === 'UNRESOLVED' ? 5_000 : false,
    refetchIntervalInBackground: false,
  });
  const activation = useQuery({
    queryKey: [...rootKey, 'activation-readiness', intent?.cabinet?.cabinet_id ?? ''],
    queryFn: ({ signal }) => gateway!.get(intent!.cabinet!.cabinet_id, { signal }),
    enabled: enabled && intent?.action === 'activate' && intent.cabinet !== null,
    retry: false,
  });
  const navigate = (values: Record<string, string>) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    for (const [key, value] of Object.entries(values)) { if (value === '') next.delete(key); else next.set(key, value); }
    return next;
  });
  const setFilter = (values: Record<string, string>) => navigate({ ...values, cabinet_cursor: '', cabinet_id: '' });
  const resetFilters = () => navigate({ keyword: '', merchant: '', lifecycle: '', connectivity: '', occupancy: '', cabinet_cursor: '', cabinet_id: '' });
  const begin = (action: CabinetManagementAction, cabinet: ManagedCabinet | null = null) => {
    if (inFlight.current || uncertain || commandBusy) return;
    originalRequest.current = null;
    setFailure('');
    setMerchantCursor('');
    setForm({ ...managementForm, device: cabinet?.provider_device_id ?? '', name: cabinet?.cabinet_name ?? '', description: cabinet?.description ?? '', count: cabinet?.compartment_count ?? 1 });
    setIntent({ action, cabinet, key: randomId() });
  };
  const save = useMutation({
    mutationFn: async () => {
      if (gateway === undefined || intent === null || !canRead) throw new Error('当前身份不可用');
      if (originalRequest.current !== null) return originalRequest.current();
      const reason = form.reason.trim();
      if (reason.length < 3 || reason.length > 256) throw new Error('请输入 3～256 字操作原因');
      const { action, cabinet, key } = intent;
      let request: () => Promise<ManagedCabinet>;
      const metadata = { cabinet_name: form.name.trim(), description: form.description.trim() || null, reason };
      if (action === 'create') {
        if (!/^[1-9][0-9]{0,63}$/.test(form.device) || !Number.isInteger(form.count) || form.count < 1 || form.count > 48) throw new Error('请检查设备编号和 1～48 格口数量');
        const body = cabinetCreateInput(form);
        request = () => gateway.create(body, key);
      } else {
        if (cabinet === null) throw new Error('请重新读取柜机');
        if (action === 'update') request = () => gateway.update(cabinet, metadata, key);
        else if (action === 'activate') {
          const current = activation.data;
          if (!current || activation.isError) throw new Error('请重新读取柜机后启用');
          request = () => gateway.activate(current, { reason }, key);
        } else if (action === 'resize') {
          if (!form.confirmed || !Number.isInteger(form.count) || form.count < 1 || form.count > 48) throw new Error('请确认物理布局和 1～48 格口数量');
          const body = { reason, physical_layout_confirmed: true, target_count: form.count } as const;
          request = () => gateway.adjust(cabinet, body, key);
        } else request = () => gateway.lifecycle(cabinet, action, { reason }, key);
      }
      originalRequest.current = request;
      return request();
    },
    retry: false,
    onSuccess: async (cabinet) => {
      originalRequest.current = null; setUncertain(false); setIntent(null); setFailure('');
      navigate({ cabinet_id: cabinet.cabinet_id });
      await queryClient.invalidateQueries({ queryKey: rootKey });
      await MessagePlugin.success('服务器已确认保存');
    },
    onError: (error) => {
      const result = cabinetManagementFailure(error, originalRequest.current !== null);
      setUncertain(result.uncertain);
      if (!result.uncertain) originalRequest.current = null;
      setFailure(result.message);
    },
  });
  const submit = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try { await save.mutateAsync(); } catch { /* The mutation exposes a redacted, explicit error above. */ }
    finally { inFlight.current = false; }
  };
  // Keep the same selected/account-keyed aggregate mounted during a transient
  // read failure so an unresolved write retains its original idempotency intent.
  const cabinet = detail.data?.cabinet_id === selected ? detail.data : undefined;
  const selectedBox = slots.data?.items.find((item) => item.compartment_id === selectedBoxId) ?? null;
  const changing = intent?.action === 'create' || intent?.action === 'update';
  const resizing = intent?.action === 'resize';
  const needsConfirmation = resizing;
  const canManage = session.permissions.includes('ops.cabinets.manage');
  if (!canRead || gateway === undefined) return <Alert theme="warning" message="请登录具有租赁柜读取权限的后台账户；不使用演示身份或数据。" />;
  return <div className="page-stack">
    <PageHeader title="租赁柜管理" actions={<Space><Button variant="outline" icon={<RefreshIcon />} disabled={list.isFetching || commandBusy || intent !== null} onClick={() => void queryClient.invalidateQueries({ queryKey: rootKey })}>刷新状态</Button><Button tag="button" theme="primary" icon={<AddIcon />} disabled={!canManage || commandBusy || intent !== null || uncertain || save.isPending} onClick={() => begin('create')}>录入租赁柜</Button></Space>} />
    <AdminListPanel title="租赁柜列表" count={list.data?.statistics.total ?? 0} countLabel="台" description="选择柜机查看格口、在柜资产与操作记录；统计覆盖当前筛选的全部页。" filters={(
      <ListFilterBar className="cabinet-filter-bar" ariaLabel="租赁柜筛选" summary={`当前筛选共 ${list.data?.statistics.total ?? 0} 台`} actions={<Button variant="text" icon={<RefreshIcon />} onClick={resetFilters}>重置筛选</Button>}>
        <ListFilterField label="关键词" wide><Input value={keywordFilter} clearable placeholder="柜机、商家或地址" onChange={(keyword) => setFilter({ keyword })} /></ListFilterField>
        <ListFilterField label="商家"><Select value={merchantFilter} clearable placeholder="全部商家" options={merchants.data?.items.map((merchant) => ({ label: merchant.name, value: merchant.merchant_id })) ?? []} onChange={(merchant) => setFilter({ merchant: String(merchant ?? '') })} /></ListFilterField>
        <ListFilterField label="生命周期"><Select value={lifecycleFilter} clearable placeholder="全部状态" options={[{ label: '启用', value: 'ACTIVE' }, { label: '停用', value: 'INACTIVE' }, { label: '归档', value: 'ARCHIVED' }]} onChange={(lifecycle) => setFilter({ lifecycle: String(lifecycle ?? '') })} /></ListFilterField>
        <ListFilterField label="在线状态"><Select value={connectivityFilter} clearable placeholder="全部状态" options={[{ label: '在线', value: 'ONLINE' }, { label: '离线', value: 'OFFLINE' }, { label: '未知', value: 'UNKNOWN' }]} onChange={(connectivity) => setFilter({ connectivity: String(connectivity ?? '') })} /></ListFilterField>
        <ListFilterField label="格口占用"><Select value={occupancyFilter} clearable placeholder="全部格口" options={[{ label: '有在柜资产', value: 'OCCUPIED' }, { label: '有可用格口', value: 'AVAILABLE' }, { label: '全部占用', value: 'FULL' }]} onChange={(occupancy) => setFilter({ occupancy: String(occupancy ?? '') })} /></ListFilterField>
      </ListFilterBar>
    )}>
      <Space breakLine><Button tag="button" disabled={list.isFetching || commandBusy || intent !== null} onClick={() => void queryClient.invalidateQueries({ queryKey: rootKey })}>刷新柜机记录</Button><Button tag="button" disabled={cursor === '' || list.isFetching || commandBusy || intent !== null} onClick={() => navigate({ cabinet_cursor: '' })}>最新一页柜机</Button><Button tag="button" disabled={!list.data?.page.has_more || !list.data.page.next_cursor || list.isFetching || commandBusy || intent !== null} onClick={() => navigate({ cabinet_cursor: list.data?.page.next_cursor ?? '' })}>下一页柜机</Button></Space>
      {list.isLoading ? <p role="status">正在读取租赁柜…</p> : null}
      {list.isError ? <Alert theme="error" message="柜机列表加载失败，请手动刷新；未显示演示数据。" /> : null}
      {!list.isError && list.data?.items.length === 0 ? <p>暂无租赁柜</p> : null}
      <div className="cabinet-workspace"><div className="cabinet-list-panel"><div className="cabinet-list-caption">选择柜机查看详情</div><div className="cabinet-list">
        {!list.isError ? list.data?.items.map((item) => <article className={`cabinet-list-item${selected === item.cabinet_id ? ' is-active' : ''}`} key={item.cabinet_id}><Button variant="text" tag="button" type="button" className="cabinet-list-select" disabled={commandBusy || intent !== null || uncertain || save.isPending} onClick={() => navigate({ cabinet_id: item.cabinet_id })} aria-pressed={selected === item.cabinet_id}><span className="cabinet-list-copy"><strong>{item.cabinet_name}</strong><small>{item.merchant_name ?? '未关联商家'}</small><small>{item.deployment_site_address ?? '商家经营地址未配置'}</small><code>{item.provider_device_id}</code></span><StatusTag value={item.connectivity_status} /></Button></article>) : null}
      </div></div><Drawer visible={selected !== ''} header={cabinet?.cabinet_name ?? '租赁柜详情'} size="min(1120px, 96vw)" footer={false} closeOnOverlayClick={false} onClose={() => { if (!commandBusy && !uncertain && !stockingCreate && intent === null) navigate({ cabinet_id: '' }); }}><section className="cabinet-detail-panel">
        {detail.isError || slots.isError ? <Alert theme="error" message="详情读取失败，操作已暂停，请刷新核对。" /> : null}
        {cabinet === undefined ? null : <>
          {!detail.isError && <CabinetMiniProgramCode key={`${session.accountId}:${cabinet.cabinet_id}`} cabinetId={cabinet.cabinet_id} />}
          <div className="cabinet-detail-heading"><div><span className="mono-value">{cabinet.provider_device_id}</span><h2>{cabinet.cabinet_name}</h2></div><Space><StatusTag value={cabinet.lifecycle_status} /><StatusTag value={cabinet.connectivity_status} /><Tag variant="light">{cabinet.compartment_count} 个格口</Tag></Space></div>
          <div className="cabinet-location-summary"><strong>{cabinet.merchant_name ?? '所属商家'}</strong><address>{cabinet.deployment_site_address ?? '商家经营地址未配置'}</address><small>地址继承商家 · 设备编号创建后不可修改 · 确认不代表格口空闲{cabinet.connectivity_stale ? ' · 观察已过期或尚无可靠观察' : ''}</small></div>
          {cabinet.initial_observation_command_id ? <Alert theme={initialObservation.isError || initialObservation.data?.execution_status === 'UNKNOWN' ? 'warning' : 'info'} message={initialObservation.isError ? `首次逐格查询 ${cabinet.initial_observation_command_id} 的进度读取失败，请刷新后核对格口门态。` : initialObservation.data ? `首次逐格查询目标 ${initialObservation.data.targets.length} 格；执行 ${initialObservation.data.execution_status}，观察 ${initialObservation.data.observation_status}。任务 ${cabinet.initial_observation_command_id}。门态查询独立进行，不影响在线启用。` : `创建后已提交首次逐格门态查询，任务 ${cabinet.initial_observation_command_id}；正在读取查询进度。`} /> : null}
          <div className="cabinet-entry-action"><div><strong>资产入柜</strong><p>登记资产实际投放的格口；入柜后仍需管理员另行上架。</p></div><Button tag="button" theme="primary" disabled={!canManage || !session.permissions.includes('ops.assets.manage') || !session.permissions.includes('ops.assets.read') || intent !== null || commandBusy || uncertain || detail.isError || detail.isFetching || slots.isError} onClick={() => setStockingCreate(true)}>资产入柜</Button></div>
          <div className="cabinet-capabilities"><span><ServerIcon />业务占用<strong>{cabinet.occupancy_summary.occupied} 已占用 / {cabinet.occupancy_summary.available} 可用</strong></span><span><ServerIcon />最近观察<strong>{cabinet.last_success_at === null ? '暂无' : formatUTC(cabinet.last_success_at)}</strong></span></div>
          <AdminTabs value={cabinetTab} aria-label="柜机详情分区" onChange={(value) => { if (detail.isError) return; if (value === 'compartments' || value === 'inventory' || value === 'operations' || value === 'history') setCabinetTab(value); }}>
            <AdminTabPanel value="compartments" label="格口状态">{cabinetTab === 'compartments' && <div className="cabinet-console"><div className="cabinet-console__meta"><span>格口状态</span><small>按编号排列 · 门态与业务占用分开显示</small></div><div className="cabinet-box-grid">{slots.isError ? null : slots.data?.items.map((box) => <ManagedCabinetBoxCard key={box.compartment_id} box={box} onDetails={() => setSelectedBoxId(box.compartment_id)} />)}</div>{!slots.isError && slots.data?.items.length === 0 ? <p>暂无可显示格口</p> : null}</div>}</AdminTabPanel>
            <AdminTabPanel value="inventory" label="在柜资产">{!detail.isError && cabinetTab === 'inventory' && <CabinetInventoryPanel key={cabinet.cabinet_id} cabinetId={cabinet.cabinet_id} gateway={gateway} accountId={session.accountId} visible={visible} />}</AdminTabPanel>
            <AdminTabPanel value="operations" label="设备操作">{cabinetTab === 'operations' && <CabinetApiCommands key={`${session.accountId}:${cabinet.cabinet_id}`} cabinet={cabinet} slots={slots.data?.items ?? []} gateway={gateway} accountId={session.accountId} visible={visible} disabled={detail.isError || slots.isError || detail.isFetching || intent !== null || uncertain || save.isPending} onBusyChange={setCommandBusy} onShowHistory={() => { if (!detail.isError) setCabinetTab('history'); }} />}</AdminTabPanel>
            <AdminTabPanel value="history" label="操作记录">{!detail.isError && cabinetTab === 'history' && <CabinetProviderOperationsPanel key={cabinet.cabinet_id} cabinetId={cabinet.cabinet_id} gateway={gateway} accountId={session.accountId} visible={visible} />}</AdminTabPanel>
          </AdminTabs>
          <AdminDisclosure className="cabinet-management-actions" title={<>柜机管理</>}><div className="cabinet-management-actions__body"><Space breakLine>{(['update', 'activate', 'deactivate', 'archive', 'restore', 'resize'] as const).map((action) => <Button size="small" variant="outline" tag="button" key={action} disabled={!cabinet.allowed_actions[action] || commandBusy || intent !== null || detail.isError || slots.isError || detail.isFetching || uncertain || save.isPending} onClick={() => begin(action, cabinet)}>{managementLabels[action]}</Button>)}</Space></div></AdminDisclosure>
          {cabinet.active_command_id === null ? null : <Alert theme="warning" message="存在未释放命令，相关操作被拦截。" />}

        </>}
      </section></Drawer></div>
    </AdminListPanel>
    <CabinetCompartmentDrawer compartment={selectedBox} onClose={() => setSelectedBoxId('')} />
    <CabinetStockingCreateDialog key={stockingCreate && cabinet && !detail.isError ? cabinet.cabinet_id : 'closed'} cabinet={stockingCreate && cabinet && !detail.isError ? cabinet : null} gateway={gateway} accountId={session.accountId} onClose={() => setStockingCreate(false)} onPlaced={async () => { setCabinetTab('inventory'); await queryClient.invalidateQueries({ queryKey: queryKeys.domain('assets') }); await MessagePlugin.success('资产已入柜，仍未上架；请到资产管理点击上架。'); }} />
    <AdminFormDrawer visible={intent !== null} title={intent === null ? '' : managementLabels[intent.action]} description={intent?.action === 'create' ? '先选择已有经营地址的商家，再填写当前设备。保存时检测在线状态，在线自动启用。' : undefined} confirmText={uncertain ? '用原请求核对' : intent?.action === 'create' ? '保存并生成格口' : '提交服务器确认'} form={controller} values={form} size={changing ? 'complex' : 'compact'} pending={save.isPending} dirty={intent !== null} errorSummary={failure || undefined} onCancel={() => { if (!inFlight.current && !uncertain) { setIntent(null); originalRequest.current = null; } }} onSubmit={submit}>
      {uncertain ? <Alert theme="warning" message="原请求的内容、版本和幂等键已保留。请核对结果后再发起新操作。" /> : null}
      {intent?.action === 'create' && <FormSection title="商家与经营地址" description="地址来自所选商家的已确认经营资料，不在租赁柜中重复录入。"><FormGrid columns={1}>
        <Form.FormItem label="所属商家" name="merchantId" rules={[{ required: true, message: '请选择已配置经营地址的商家' }]}>
          <Select placeholder="选择已配置经营地址的商家" value={form.merchantId} disabled={uncertain || merchants.isFetching} options={merchants.data?.items.map((merchant) => ({ value: merchant.merchant_id, label: merchant.name, disabled: merchant.status !== 'ACTIVE' || merchant.business_profile === null })) ?? []} onChange={(value) => {
            const merchant = merchants.data?.items.find((item) => item.merchant_id === value);
            if (!merchant) return;
            const profile = merchant.business_profile!;
            setForm((current) => ({ ...current, merchantId: merchant.merchant_id, merchantLabel: `${merchant.name} · ${profile.province_name}${profile.city_name}${profile.district_name}${profile.address.detail_address}` }));
          }} />
          <Space><Button variant="text" disabled={uncertain || merchantCursor === '' || merchants.isFetching} onClick={() => setMerchantCursor('')}>第一页</Button><Button variant="text" disabled={uncertain || merchants.isFetching || !merchants.data?.page.has_more || !merchants.data.page.next_cursor} onClick={() => setMerchantCursor(merchants.data?.page.next_cursor ?? '')}>下一页商家</Button></Space>
          {(merchants.isError || !session.permissions.includes('ops.merchants.read')) && <p role="alert">无法读取商家目录，请核对商家读取权限后重试。</p>}
        </Form.FormItem>
        <Form.FormItem label="经营地址（继承商家）"><div className="cabinet-address-confirm" data-empty={!form.merchantLabel}>{form.merchantLabel || '选择商家后显示经营地址'}</div></Form.FormItem>
      </FormGrid></FormSection>}
      <FormSection title={changing ? '设备信息' : '目标租赁柜'} description={intent?.action === 'create' ? '设备编号创建后不能修改；格口数量以柜机实际配置为准。' : undefined}><FormGrid>
        <Form.FormItem label="设备编号" name="device" {...(intent?.action === 'create' ? { rules: [{ required: true, pattern: /^[1-9][0-9]{0,63}$/, message: '请输入非 0 开头的数字设备编号' }] } : {})}><Input value={form.device} disabled={intent?.action !== 'create' || uncertain} onChange={(device) => setForm((p) => ({ ...p, device }))} /></Form.FormItem>
        {changing ? <>
          <Form.FormItem label="柜机名称" name="name" rules={[{ required: true, whitespace: true, max: 128, message: '请输入 1～128 字柜机名称' }]}><Input value={form.name} disabled={uncertain} onChange={(name) => setForm((p) => ({ ...p, name }))} /></Form.FormItem>
          {intent?.action === 'update' && <Form.FormItem label="经营地址（继承商家）"><div className="cabinet-address-confirm">{intent.cabinet?.address === null ? '商家经营地址未配置' : `${intent.cabinet?.address.province_name ?? ''}${intent.cabinet?.address.city_name ?? ''}${intent.cabinet?.address.district_name ?? ''}${intent.cabinet?.address.detail_address ?? ''}`}</div></Form.FormItem>}
          <Form.FormItem className="admin-form-grid__full" label="说明" name="description"><Input maxlength={512} value={form.description} disabled={uncertain} onChange={(description) => setForm((p) => ({ ...p, description }))} /></Form.FormItem>
        </> : null}
        {intent?.action === 'create' || resizing ? <Form.FormItem label="格口数量" name="count" rules={[{ required: true, message: '请输入 1～48 个格口' }]}><InputNumber min={1} max={48} decimalPlaces={0} value={form.count} disabled={uncertain} onChange={(count) => setForm((p) => ({ ...p, count: Number(count) }))} /></Form.FormItem> : null}
        {intent?.action === 'create' ? <p className="cabinet-form-note admin-form-grid__full">保存时实时检测设备：在线则启用，离线或查询未确认则保持停用。按配置生成格口并查询门态，门态不作为启用条件。</p> : null}
        {resizing ? <p className="cabinet-form-note admin-form-grid__full">仅调整尾部：{intent.cabinet?.compartment_count} → {form.count} 格。退休编号和历史保留；缺少可靠空闲依据将拒绝缩减或恢复。</p> : null}
      </FormGrid></FormSection>
      <FormSection title="操作确认" description={intent?.action === 'create' ? '填写录入原因，提交后可在详情查看首次格口查询进度。' : '启用时实时检测设备在线；调整格口数量仍需核对实际布局。'}><FormGrid columns={1}>
        {needsConfirmation ? <Form.FormItem label="现场确认" name="confirmed"><Checkbox  checked={form.confirmed} disabled={uncertain} onChange={(nextValue) => setForm((p) => ({ ...p, confirmed: nextValue }))}>已核对本次目标物理布局</Checkbox></Form.FormItem> : null}
        {intent?.action === 'activate' ? <div className="cabinet-activation-readiness">
          {activation.isFetching ? <p>正在读取当前启用条件…</p> : null}
          {activation.isError ? <Alert theme="error" message="启用条件读取失败，请重新打开此抽屉。" /> : null}
          <Alert theme="info" message="提交时将实时检测柜机在线状态，在线才能启用。已有资产占用与未完成业务不会被清除。" />
        </div> : null}
        <Form.FormItem label="操作原因" name="reason" rules={[{ required: true, min: 3, max: 256, message: '请输入 3～256 字原因' }]}><Input aria-label="操作原因" maxlength={256} value={form.reason} disabled={uncertain} onChange={(reason) => setForm((p) => ({ ...p, reason }))} /></Form.FormItem>
      </FormGrid></FormSection>
    </AdminFormDrawer>
  </div>;
}
