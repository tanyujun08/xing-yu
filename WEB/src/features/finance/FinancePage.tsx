import { randomId } from '../../shared/randomId';
import { AdminRouteLink as Link } from '../../shared/ui/AdminRouteLink';
import { AdminDatePicker } from '../../shared/ui/AdminDatePicker';
import '../rental-orders/rental-ui.css';
import { rentalLabel, rentalLabels } from '../rental-orders/rentalLabels';
import { useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Drawer, Input, Select, Space, Table, type PrimaryTableCol } from 'tdesign-react';
import { CloseIcon } from 'tdesign-icons-react';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';
import type { components, operations } from '../../shared/services/rentalOrders';
import { rentalFailure, rentalUnknown, type EarningFilter } from '../../shared/services/rentalOrders';
import { formatUTC } from '../../shared/format/time';
import { PageHeader } from '../../shared/ui/PageHeader';
import { AdminListPanel } from '../../shared/ui/AdminListPanel';
import { AdminTabs, AdminTabPanel } from '../../shared/ui/AdminTabs';
import { ListFilterBar, ListFilterField } from '../../shared/ui/ListFilterBar';
import { RentalBlockers, RentalFacts, RentalLookup, RentalPager, RentalReadState, rentalMoney } from '../rental-orders/RentalShared';

type Payment = components['schemas']['OpsPaymentView']; type Refund = components['schemas']['OpsRefundView']; type Earning = components['schemas']['OpsEarningView'];
const beneficiaryLabel = (row: Earning) => row.beneficiary_kind === 'MERCHANT' ? `${row.merchant_name?.trim() || '商家名称不可用'} · ${row.merchant_id}` : `${row.beneficiary_display_name?.trim() || '显示名不可用'} · ${row.account_id}`;
const recordButtonStyle: CSSProperties = { maxWidth: '100%', height: 'var(--td-comp-size-m)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', textAlign: 'left' };
const recordLabelStyle: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
export function FinancePage() {
  const session = useSession();
  const [params, setParams] = useSearchParams(); const tab = params.get('tab') ?? 'earnings';
  return <div className="page-stack"><PageHeader title="财务与商家结算" description="个人收益入账，商家按流水线下结算；资金状态以渠道可信结果为准。" />
    <AdminTabs value={tab} onChange={(value) => setParams({ tab: String(value), ...(params.get('order_no') ? { order_no: params.get('order_no')! } : {}) })}><AdminTabPanel value="earnings" label="收益流水" /><AdminTabPanel value="payments" label="支付记录" /><AdminTabPanel value="refunds" label="退款记录" /></AdminTabs>
    {tab === 'earnings' ? <EarningsPanel key={session.accountId} /> : <FundsPanel key={`${session.accountId}:${tab}`} kind={tab === 'refunds' ? 'refund' : 'payment'} />}
  </div>;
}
function FundsPanel({ kind }: { kind: 'payment' | 'refund' }) {
  const statusLabels = kind === 'payment' ? rentalLabels.payment : rentalLabels.refund;
  const session = useSession(); const gateway = useAdminServices().rentalOrders; const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(params.get('order_no') ?? ''); const [manualSelected, setSelected] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const inFlight = useRef(false);
  const detailTrigger = useRef<HTMLElement | null>(null);
  const original = useRef<{ run: () => Promise<unknown>; id: string } | null>(null); const cursor = params.get('cursor') ?? '';
  const [unknown, setUnknown] = useState(false);
  const filter = { order_no: params.get('order_no') ?? '', purpose: params.get('purpose') ?? '', status: params.get('status') ?? '', cursor, limit: 20 };
  const query = useQuery<components['schemas']['OpsPaymentPage'] | components['schemas']['OpsRefundPage']>({ queryKey: ['rental-funds', session.accountId, kind, filter], enabled: !!gateway && session.permissions.includes('ops.finance.read'), queryFn: ({ signal }) => kind === 'payment' ? gateway!.payments(filter as NonNullable<operations['O01']['parameters']['query']>, signal) : gateway!.refunds(filter as NonNullable<operations['O02']['parameters']['query']>, signal), retry: false });
  const linkedPaymentID = kind === 'payment' ? params.get('payment_id') : null;
  const canRead = session.permissions.includes('ops.finance.read');
  // An order detail link is only a locator. Open the original authorized O01 row.
  const selected = canRead && !query.isError ? linkedPaymentID
    ? query.data?.items.find((row) => 'payment_id' in row && row.payment_id === linkedPaymentID && row.purpose === 'SUPPLEMENT') ?? null
    : query.data?.items.find((row) => ('payment_id' in row ? row.payment_id : row.refund_id) === manualSelected) ?? null : null;
  const update = (values: Record<string, string>, reset = true) => setParams((old) => { const next = new URLSearchParams(old); if (reset) next.delete('cursor'); for (const [k, v] of Object.entries(values)) { if (v) next.set(k, v); else next.delete(k); } return next; });
  const idOf = (row: Payment | Refund) => 'payment_id' in row ? row.payment_id : row.refund_id;
  const reconcile = async (row: Payment | Refund) => {
    if (!gateway || inFlight.current) return; const id = idOf(row); if (original.current && original.current.id !== id) return;
    const key = randomId(); original.current ??= { id, run: () => 'payment_id' in row ? gateway.reconcilePayment(row.payment_id, key) : gateway.reconcileRefund(row.refund_id, key) };
    inFlight.current = true; setBusy(true); setError('');
    try { await original.current.run(); original.current = null; setUnknown(false); setError('已请求核查原交易，请刷新查看渠道确认结果。'); await query.refetch(); }
    catch (caught) { const uncertain = rentalUnknown(caught); setUnknown(uncertain); if (!uncertain) original.current = null; setError(rentalFailure(caught)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const cols: PrimaryTableCol<Payment | Refund>[] = [
    { colKey: 'id', title: '资金记录', cell: ({ row }) => <Button tag="button" variant="text" style={recordButtonStyle} title={idOf(row)} disabled={busy || !!original.current && original.current.id !== idOf(row)} onClick={(event) => { detailTrigger.current = event.currentTarget; setSelected(idOf(row)); update({ payment_id: '' }, false); if (!original.current) setError(''); }}><span style={recordLabelStyle}>{idOf(row)}</span></Button> },
    { colKey: 'order_id', title: '订单', cell: ({ row }) => <Link to={`/orders/rental?order_id=${row.order_id}`}>{row.order_id}</Link> },
    { colKey: 'purpose', title: '用途', cell: ({ row }) => rentalLabel(rentalLabels.purpose, row.purpose) }, { colKey: 'status', title: '状态', cell: ({ row }) => rentalLabel(statusLabels, row.status) },
    { colKey: 'amount_fen', title: '渠道金额 / 微信实付', cell: ({ row }) => <>{row.payment_mode === 'FIXED_10_FEN' ? '测试支付 · ' : ''}{rentalMoney(row.amount_fen)}<br />{rentalMoney('payer_total_fen' in row ? row.payer_total_fen : row.payer_refund_fen)}</> },
    { colKey: 'last_verified_at', title: '最近核查', cell: ({ row }) => row.last_verified_at ? formatUTC(row.last_verified_at) : '尚未核查' },
  ];
  const normalizedOrderNo = draft.trim();
  const orderNoValid = normalizedOrderNo === '' || /^[A-Za-z0-9_-]{1,32}$/.test(normalizedOrderNo);
  const searchFunds = () => {
    if (!canRead || !gateway || !orderNoValid || query.isFetching) return;
    if (normalizedOrderNo === filter.order_no && !cursor) void query.refetch();
    else update({ order_no: normalizedOrderNo });
  };
  const recover = selected?.allowed_actions.find((a) => a.action_code === (kind === 'payment' ? 'QUERY_PAYMENT' : 'QUERY_REFUND'));
  const permission = kind === 'payment' ? 'ops.payments.recover' : 'ops.refunds.recover';
  const canRecover = session.permissions.includes(permission);
  // Losing recovery permission must not trap a reader in the drawer. Closing
  // only changes the view; the original request remains available on this row.
  const canClose = !busy && (!unknown || !canRecover);
  return <AdminListPanel title={kind === 'payment' ? '支付记录' : '退款记录'} filters={<ListFilterBar ariaLabel="资金筛选" actions={<Space><Button tag="button" loading={query.isFetching} disabled={!canRead || !gateway || query.isFetching} onClick={() => void query.refetch()}>刷新</Button><Button tag="button" onClick={() => { setParams({ tab: kind === 'payment' ? 'payments' : 'refunds' }); setDraft(''); }}>重置</Button></Space>}>
    <ListFilterField label="完整订单号"><Space direction="vertical"><Space><Input ref={(instance) => { const element = instance?.inputElement; if (!element) return; element.setAttribute('aria-label', '完整订单号'); element.setAttribute('aria-invalid', String(!orderNoValid)); if (!orderNoValid) element.setAttribute('aria-describedby', 'funds-order-search-error'); else element.removeAttribute('aria-describedby'); }} aria-label="完整订单号" aria-invalid={!orderNoValid} aria-describedby={!orderNoValid ? 'funds-order-search-error' : undefined} status={orderNoValid ? 'default' : 'error'} placeholder="输入完整订单号" value={draft} maxlength={32} onChange={setDraft} onEnter={(_, { e }) => { if (!e.nativeEvent.isComposing) searchFunds(); }} /><Button tag="button" disabled={!canRead || !gateway || !orderNoValid || query.isFetching} onClick={searchFunds}>搜索</Button></Space>{!orderNoValid ? <span id="funds-order-search-error" role="alert">订单号仅支持字母、数字、下划线和短横线，最多 32 位。</span> : null}</Space></ListFilterField>
    <ListFilterField label="用途"><Select clearable value={filter.purpose} options={(kind === 'payment' ? [['INITIAL', '初始付款'], ['SUPPLEMENT', '补缴']] : [['DEPOSIT', '退押'], ['OBSERVED_NONFULFILLMENT', '无法履约退款观察'], ['EXCESS_PAYMENT', '重复收款退款']]).map(([value, label]) => ({ value: value!, label: label! }))} onChange={(v) => update({ purpose: String(v ?? '') })} /></ListFilterField>
    <ListFilterField label="状态"><Select clearable value={filter.status} options={['CREATED', 'PROCESSING', 'UNKNOWN', 'SUCCEEDED', 'FAILED_CONFIRMED', ...(kind === 'payment' ? ['CLOSED_UNPAID'] : [])].map((value) => ({ value, label: rentalLabel(statusLabels, value) }))} onChange={(v) => update({ status: String(v ?? '') })} /></ListFilterField>
  </ListFilterBar>} pagination={<RentalPager cursor={cursor} next={query.data?.next_cursor} busy={!canRead || !gateway || query.isFetching} change={(v) => update({ cursor: v }, false)} />}>
    {canRead ? <RentalReadState pending={query.isLoading} error={query.error} retry={() => void query.refetch()} empty={query.data?.items.length === 0} /> : <Alert theme="warning" message="当前账号没有财务读取权限。" />}{canRead && !query.isError ? <Table rowKey={kind === 'payment' ? 'payment_id' : 'refund_id'} tableContentWidth="max(100%, 960px)" data={query.data?.items ?? []} columns={cols} /> : null}
    {canRead && linkedPaymentID && query.isSuccess && !selected ? <Alert theme="info" message="原补缴记录未出现在当前授权查询中，请刷新核对。" /> : null}
    <Drawer visible={!!selected} header="资金记录详情" footer={false} size="min(720px, 96vw)" closeOnOverlayClick={false}
      closeBtn={<Button tag="button" type="button" variant="text" shape="square" aria-label="关闭资金记录详情" title="关闭资金记录详情" icon={<CloseIcon />} disabled={!canClose} />}
      onBeforeClose={() => { if (canClose && detailTrigger.current?.isConnected) detailTrigger.current.focus(); }}
      onClose={() => { if (canClose) { setSelected(null); update({ payment_id: '' }, false); } }}>{selected ? <><RentalFacts entries={[
      ['记录编号', idOf(selected)], ['支付模式', selected.payment_mode === 'FIXED_10_FEN' ? '测试支付（真实资金与业务金额分开）' : '正常支付'], ['业务金额', rentalMoney(selected.business_amount_fen)], ['状态', rentalLabel(statusLabels, selected.status)], ['商户号', selected.mchid], ['支付配置版本', selected.config_version_id], ['商户单号', 'out_trade_no' in selected ? selected.out_trade_no : selected.out_refund_no], ['渠道单号', 'channel_transaction_id' in selected ? selected.channel_transaction_id : selected.channel_refund_id], ['渠道状态', selected.channel_status], ['错误码', selected.last_error_code], ['结算金额', rentalMoney(selected.amount_fen)], ['微信实际金额', rentalMoney('payer_total_fen' in selected ? selected.payer_total_fen : selected.payer_refund_fen)],
    ]} /><RentalBlockers items={selected.blockers} />{error ? <Alert theme="info" message={error} /> : null}{session.permissions.includes(permission) ? <Button tag="button" loading={busy} disabled={busy || !recover?.allowed && !unknown} onClick={() => void reconcile(selected)}>{unknown ? '恢复原核查请求' : '核查原交易结果'}</Button> : null}<p>{recover?.display_reason ?? '这里只查询原交易，不发起新扣款或新退款。'}</p></> : null}</Drawer>
  </AdminListPanel>;
}
function EarningsPanel() {
  const session = useSession(); const gateway = useAdminServices().rentalOrders; const [params, setParams] = useSearchParams();
  const month = params.get('period_month') ?? ''; const [exporting, setExporting] = useState(false); const [error, setError] = useState('');
  const detailTrigger = useRef<HTMLElement | null>(null);
  const cursor = params.get('cursor') ?? ''; const selected = params.get('earning_id') ?? '';
  const filter = { beneficiary_kind: params.get('beneficiary_kind') ?? '', merchant_id: params.get('merchant_id') ?? '', account_id: params.get('account_id') ?? '', order_no: params.get('order_no') ?? '', period_month: params.get('period_month') ?? '', cursor, limit: 20 } as EarningFilter;
  const update = (values: Record<string, string>, reset = true) => setParams((old) => { const next = new URLSearchParams(old); if (reset) next.delete('cursor'); for (const [k, v] of Object.entries(values)) { if (v) next.set(k, v); else next.delete(k); } return next; });
  const query = useQuery({ queryKey: ['rental-earnings', session.accountId, filter], enabled: !!gateway && session.permissions.includes('ops.finance.read'), queryFn: ({ signal }) => gateway!.earnings(filter, signal), retry: false });
  const canRead = session.permissions.includes('ops.finance.read');
  const detail = useQuery({ queryKey: ['rental-earning', session.accountId, selected], enabled: !!gateway && !!selected && canRead, queryFn: ({ signal }) => gateway!.earning(selected, signal), retry: false });
  const exportReason = !canRead ? '当前账号没有财务读取权限。' : !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? '请选择有效的入账月份。'
    : filter.beneficiary_kind !== 'MERCHANT' || !!filter.account_id || !!filter.order_no ? '请选择商家收益类型，并清除个人或订单筛选后导出。'
      : query.isFetching ? '正在查询当前筛选，请稍候。' : query.isError ? '当前筛选查询失败，请先重试。'
        : !query.isSuccess || !query.data.items.length ? '当前筛选没有可导出的流水。' : '';
  const download = async () => { if (!gateway || exportReason || exporting) return; setExporting(true); setError(''); try { const blob = await gateway.exportIncome(month, filter.merchant_id); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `merchant-income-${month}.csv`; link.click(); URL.revokeObjectURL(url); } catch (caught) { setError(rentalFailure(caught)); } finally { setExporting(false); } };
  const columns: PrimaryTableCol<Earning>[] = [
    { colKey: 'earning_id', title: '收益流水', cell: ({ row }) => <Button tag="button" variant="text" style={recordButtonStyle} title={row.earning_id} onClick={(event) => { detailTrigger.current = event.currentTarget; update({ earning_id: row.earning_id }, false); }}><span style={recordLabelStyle}>{row.earning_id}</span></Button> }, { colKey: 'order_no', title: '订单号', cell: ({ row }) => <Link to={`/orders/rental?order_id=${row.order_id}`}>{row.order_no}</Link> },
    { colKey: 'beneficiary_kind', title: '受益方', cell: ({ row }) => beneficiaryLabel(row) },
    { colKey: 'asset_title', title: '资产' }, { colKey: 'beneficiary_fen', title: '收益', cell: ({ row }) => rentalMoney(row.beneficiary_fen) }, { colKey: 'posted_at', title: '入账时间', cell: ({ row }) => formatUTC(row.posted_at) },
  ];
  const d = canRead ? detail.data : undefined;
  return <AdminListPanel title="收益流水" description="商家结算在线下完成，系统仅提供收益流水导出；个人收益只入账。" filters={<ListFilterBar ariaLabel="收益筛选" actions={<Space><Button tag="button" loading={query.isFetching} disabled={!canRead || !gateway || query.isFetching} onClick={() => void query.refetch()}>刷新</Button><Button tag="button" onClick={() => { setParams({ tab: 'earnings' }); }}>重置</Button></Space>}>
    <ListFilterField label="收益类型"><Select clearable value={filter.beneficiary_kind ?? ''} options={[{ label: '商家', value: 'MERCHANT' }, { label: '个人', value: 'PERSONAL' }]} onChange={(v) => update({ beneficiary_kind: String(v ?? ''), merchant_id: '', account_id: '' })} /></ListFilterField>
    <ListFilterField label="商家"><RentalLookup kind="merchant" value={filter.merchant_id ?? ''} change={(v) => update({ merchant_id: v, beneficiary_kind: 'MERCHANT', account_id: '' })} /></ListFilterField>
    <ListFilterField label="个人"><RentalLookup kind="account" value={filter.account_id ?? ''} change={(v) => update({ account_id: v, beneficiary_kind: 'PERSONAL', merchant_id: '' })} /></ListFilterField>
    <ListFilterField label="完整订单号"><Input value={filter.order_no ?? ''} onChange={(v) => update({ order_no: v })} /></ListFilterField>
    <ListFilterField label="入账自然月"><AdminDatePicker className="rental-date-input" aria-label="入账自然月" type="month" value={month} onChange={(nextValue) => update({ period_month: nextValue })} /></ListFilterField>
    <Space direction="vertical"><Button tag="button" disabled={exporting || !!exportReason} loading={exporting} onClick={() => void download()}>导出当月商家流水 CSV</Button>{exportReason ? <span>{exportReason}</span> : null}</Space>
  </ListFilterBar>} pagination={<RentalPager cursor={cursor} next={query.data?.next_cursor} busy={!canRead || !gateway || query.isFetching} change={(v) => update({ cursor: v }, false)} />}>
    {canRead && !query.isError && query.data?.summary ? <p>当前筛选共 {query.data.summary.count} 笔，受益方合计 {rentalMoney(query.data.summary.beneficiary_fen)}；统计时点 {formatUTC(query.data.summary.as_of)}</p> : null}
    {canRead && error ? <Alert theme="error" message={error} /> : null}{canRead ? <RentalReadState pending={query.isLoading} error={query.error} retry={() => void query.refetch()} empty={query.data?.items.length === 0} /> : null}{canRead && !query.isError ? <Table rowKey="earning_id" tableContentWidth="max(100%, 960px)" columns={columns} data={query.data?.items ?? []} /> : null}
    <Drawer visible={canRead && !!selected} header="收益明细" footer={false} size="min(720px, 96vw)"
      closeBtn={<Button tag="button" type="button" variant="text" shape="square" aria-label="关闭收益明细" title="关闭收益明细" icon={<CloseIcon />} />}
      onBeforeClose={() => { if (detailTrigger.current?.isConnected) detailTrigger.current.focus(); }}
      onClose={() => update({ earning_id: '' }, false)}>{canRead ? <RentalReadState pending={detail.isLoading} error={detail.error} retry={() => void detail.refetch()} /> : null}{d && !detail.isError ? <RentalFacts entries={[
      ['订单', <Link to={`/orders/rental?order_id=${d.order_id}`}>{d.order_no}</Link>], ['受益方', beneficiaryLabel(d)], ['租金', rentalMoney(d.rent_fen)], ['超期', rentalMoney(d.overtime_fen)], ['损失', rentalMoney(d.loss_fen)], ['平台补贴', rentalMoney(d.subsidy_fen)], ['受益方收益', rentalMoney(d.beneficiary_fen)], ['平台收益', rentalMoney(d.platform_fen)], ['入账时间', formatUTC(d.posted_at)],
    ]} /> : null}</Drawer>
  </AdminListPanel>;
}
