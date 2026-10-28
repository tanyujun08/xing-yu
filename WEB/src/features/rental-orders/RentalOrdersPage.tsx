import { AdminDatePicker } from '../../shared/ui/AdminDatePicker';
import './rental-ui.css';
import { rentalExceptionLabel, rentalLabel, rentalLabels } from './rentalLabels';
import { useRef, useState } from 'react';
import { CloseIcon } from 'tdesign-icons-react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Drawer, Input, Select, Space, Table, type PrimaryTableCol } from 'tdesign-react';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';
import type { components } from '../../shared/services/rentalOrders';
import type { OrderFilter } from '../../shared/services/rentalOrders';
import { PageHeader } from '../../shared/ui/PageHeader';
import { AdminListPanel } from '../../shared/ui/AdminListPanel';
import { ListFilterBar, ListFilterField } from '../../shared/ui/ListFilterBar';
import { formatUTC } from '../../shared/format/time';
import { RentalLookup, RentalPager, RentalReadState, rentalMoney } from './RentalShared';
import { RentalOrderDetail } from './RentalOrderDetail';
import { beijingInputToUTC, utcToBeijingInput } from './rentalForm';

type Row = components['schemas']['OpsOrderSummary'];
export function RentalOrdersPage() {
  const session = useSession(); const gateway = useAdminServices().rentalOrders;
  const canRead = session.permissions.includes('ops.orders.read');
  const [params, setParams] = useSearchParams(); const [orderNo, setOrderNo] = useState(params.get('order_no') ?? '');
  const detailTrigger = useRef<HTMLElement | null>(null);
  const cursor = params.get('cursor') ?? ''; const selected = params.get('order_id') ?? '';
  const update = (values: Record<string, string>, reset = true) => setParams((old) => { const next = new URLSearchParams(old); if (reset) next.delete('cursor'); for (const [k, v] of Object.entries(values)) { if (v) next.set(k, v); else next.delete(k); } return next; });
  const filter = Object.fromEntries([...params].filter(([key]) => key !== 'order_id')) as OrderFilter;
  const from = params.get('created_from'); const before = params.get('created_before');
  const dateRangeValid = (!from || Number.isFinite(Date.parse(from))) && (!before || Number.isFinite(Date.parse(before))) && (!from || !before || Date.parse(from) < Date.parse(before));
  const refresh = () => { if (canRead && gateway && dateRangeValid && !result.isFetching) void result.refetch(); };
  const result = useQuery({ queryKey: ['rental-orders', session.accountId, filter], enabled: !!gateway && canRead && dateRangeValid, queryFn: ({ signal }) => gateway!.list({ ...filter, limit: 20 }, signal), retry: false, refetchInterval: 5000, refetchIntervalInBackground: false, refetchOnWindowFocus: true });
  const normalizedOrderNo = orderNo.trim();
  const orderNoValid = normalizedOrderNo === '' || /^[A-Za-z0-9_-]{1,32}$/.test(normalizedOrderNo);
  const searchOrders = () => {
    if (!canRead || !gateway || !dateRangeValid || !orderNoValid || result.isFetching) return;
    if (normalizedOrderNo === (params.get('order_no') ?? '') && !cursor) void result.refetch();
    else update({ order_no: normalizedOrderNo });
  };
  const select = (name: keyof OrderFilter, label: string, options: [string, string][]) => <ListFilterField label={label}><Select value={params.get(name) ?? ''} clearable options={options.map(([value, label]) => ({ value, label }))} onChange={(value) => update({ [name]: String(value ?? '') })} /></ListFilterField>;
  const columns: PrimaryTableCol<Row>[] = [
    { colKey: 'order_no', width: 180, title: '订单编号', cell: ({ row }) => <Button tag="button" type="button" className="rental-record-link" title={row.order_no} variant="text" onClick={(event) => { detailTrigger.current = event.currentTarget; update({ order_id: row.order_id }, false); }}>{row.order_no}</Button> },
    { colKey: 'asset', width: 170, title: '资产', cell: ({ row }) => row.asset.title },
    { colKey: 'participants', width: 170, title: '承租人 / 出租方', cell: ({ row }) => <>{row.participants.tenant_display_name ?? row.participants.tenant_account_id}<br />{row.participants.merchant_name ?? row.participants.lessor_display_name ?? row.participants.lessor_id}</> },
    { colKey: 'supply_channel', width: 150, title: '类型', cell: ({ row }) => row.supply_channel === 'PERSONAL' ? '个人 · 快递往返' : '官方 · 柜取柜还' },
    { colKey: 'display_status', width: 220, title: '订单状态', cell: ({ row }) => <>{row.display_status}{row.has_exception ? <p>异常：{row.exception_codes.map((code) => rentalExceptionLabel(code, row.blockers)).join('、')}</p> : null}</> },
    { colKey: 'physical_status', width: 100, title: '实物状态', cell: ({ row }) => rentalLabel(rentalLabels.physical, row.physical_status) }, { colKey: 'review_status', width: 100, title: '审核状态', cell: ({ row }) => rentalLabel(rentalLabels.review, row.review_status) },
    { colKey: 'initial_due_fen', width: 160, title: '应付 / 微信实付', cell: ({ row }) => <>{rentalMoney(row.initial_due_fen)}<br />{rentalMoney(row.initial_payer_total_fen)}</> },
    { colKey: 'created_at', width: 190, title: '创建时间', cell: ({ row }) => formatUTC(row.created_at) },
  ];
  return <div className="page-stack"><PageHeader title="租赁订单" description="官方柜取柜还，个人快递往返。列表状态与金额均来自订单记录。" />
    <AdminListPanel title="租赁订单列表" filters={<ListFilterBar ariaLabel="租赁订单筛选" actions={<Space><Button tag="button" type="button" onClick={() => { setParams({}); setOrderNo(''); }}>重置</Button><Button tag="button" disabled={!canRead || !gateway || !dateRangeValid || result.isFetching} loading={result.isFetching} onClick={refresh}>刷新</Button></Space>}>
      <ListFilterField label="完整订单号"><Space direction="vertical"><Space><Input ref={(instance) => { const element = instance?.inputElement; if (!element) return; element.setAttribute('aria-label', '完整订单号'); element.setAttribute('aria-invalid', String(!orderNoValid)); if (!orderNoValid) element.setAttribute('aria-describedby', 'rental-order-search-error'); else element.removeAttribute('aria-describedby'); }} aria-label="完整订单号" aria-invalid={!orderNoValid} aria-describedby={!orderNoValid ? 'rental-order-search-error' : undefined} status={orderNoValid ? 'default' : 'error'} placeholder="输入完整订单号" value={orderNo} maxlength={32} onChange={setOrderNo} onEnter={(_, { e }) => { if (!e.nativeEvent.isComposing) searchOrders(); }} /><Button tag="button" type="button" disabled={!canRead || !gateway || !dateRangeValid || !orderNoValid || result.isFetching} onClick={searchOrders}>搜索</Button></Space>{!orderNoValid ? <span id="rental-order-search-error" role="alert">订单号仅支持字母、数字、下划线和短横线，最多 32 位。</span> : null}</Space></ListFilterField>
      {select('supply_channel', '供给类型', [['PERSONAL', '个人'], ['OFFICIAL_CABINET', '官方柜机']])}
      {select('stage', '订单阶段', [['PREPARING', '准备中'], ['AWAITING_PAYMENT', '待支付'], ['ACTIVE', '履约中'], ['COMPLETED', '已完成'], ['CLOSED', '已关闭']])}
      {select('physical_status', '实物状态', [['NOT_DELIVERED', '未交付'], ['OUTBOUND', '发货在途'], ['IN_USE', '使用中'], ['RETURN_PENDING', '待归还'], ['RETURN_IN_TRANSIT', '寄回在途'], ['RETURN_VERIFICATION', '归还核实中'], ['RECEIVED', '已收回']])}
      {select('review_status', '审核状态', [['NOT_STARTED', '未审核'], ['PENDING', '待审核'], ['MATERIAL_REQUIRED', '待补材料'], ['DISPUTED', '待核实'], ['FINAL', '已核定']])}
      {select('has_exception', '异常', [['true', '有异常'], ['false', '无异常']])}
      {select('display_status_code', '待操作视图', [['RETURN_REVIEW', '归还待审核'], ['AWAITING_SUPPLEMENT', '待补缴'], ['REFUND_PROCESSING', '退押处理中'], ['SETTLEMENT_CONFIRMING', '结算确认中']])}
      {select('sort', '排序', [['CREATED_DESC', '创建时间倒序'], ['CREATED_ASC', '创建时间正序']])}
      <ListFilterField label="资产"><RentalLookup kind="asset" value={params.get('asset_id') ?? ''} change={(v) => update({ asset_id: v })} /></ListFilterField>
      <ListFilterField label="参与用户"><RentalLookup kind="account" value={params.get('account_id') ?? ''} change={(v) => update({ account_id: v })} /></ListFilterField>
      <ListFilterField label="商家"><RentalLookup kind="merchant" value={params.get('merchant_id') ?? ''} change={(v) => update({ merchant_id: v })} /></ListFilterField>
      {(['created_from', 'created_before'] as const).map((field) => <ListFilterField key={field} label={field === 'created_from' ? '创建自（含）' : '创建至（不含）'}><AdminDatePicker className="rental-date-input" type="datetime-local" aria-label={field === 'created_from' ? '创建自（含）' : '创建至（不含）'} aria-invalid={!dateRangeValid} aria-describedby={!dateRangeValid ? 'rental-date-range-error' : undefined} value={utcToBeijingInput(params.get(field))} onChange={(nextValue) => update({ [field]: beijingInputToUTC(nextValue) ?? '' })} /></ListFilterField>)}
      {!dateRangeValid ? <p id="rental-date-range-error" role="alert">创建至必须晚于创建自，请核对日期范围后查询。</p> : null}
    </ListFilterBar>} pagination={<RentalPager cursor={cursor} next={result.data?.next_cursor} busy={!canRead || !gateway || !dateRangeValid || result.isFetching} change={(v) => update({ cursor: v }, false)} />}>
      {!canRead ? <Alert theme="warning" message="当前账号没有订单读取权限。" /> : <RentalReadState pending={result.isLoading} error={result.error} retry={refresh} empty={dateRangeValid && result.data?.items.length === 0} />}
      {!gateway ? <p>请使用真实 API 环境查看订单。</p> : null}
      {canRead && dateRangeValid && !result.isError ? <Table className="rental-order-table" rowKey="order_id" tableContentWidth="max(100%, 1440px)" columns={columns} data={result.data?.items ?? []} tableLayout="fixed" /> : null}
    </AdminListPanel>
    <Drawer visible={canRead && !!selected} size="min(1120px,96vw)" header="租赁订单详情" footer={false} closeBtn={<Button tag="button" type="button" variant="text" shape="square" aria-label="关闭租赁订单详情" title="关闭租赁订单详情" icon={<CloseIcon />} />} closeOnOverlayClick={false} onBeforeClose={() => { if (detailTrigger.current?.isConnected) detailTrigger.current.focus(); }} onClose={() => update({ order_id: '' }, false)}>{canRead && selected ? <RentalOrderDetail key={`${session.accountId}:${selected}`} id={selected} /> : null}</Drawer>
  </div>;
}
