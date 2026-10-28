import { AdminDatePicker } from '../../shared/ui/AdminDatePicker';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button, Input, Select, Space, Table, type PrimaryTableCol } from 'tdesign-react';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';
import type { CouponFilter, LotteryFilter, RedemptionFilter, MovementFilter, LoyaltyDetailKind, LoyaltyConfigKey } from '../../shared/services/loyaltyManagement';
import { loyaltyFailure } from '../../shared/services/loyaltyFailure';
import { AdminListPanel } from '../../shared/ui/AdminListPanel';
import { ListFilterBar, ListFilterField } from '../../shared/ui/ListFilterBar';
import { formatUTC } from '../../shared/format/time';
import { hasLoyaltyAccess } from './loyaltyAccess';
import { couponLabels, couponRightsText, couponTypes, prizeCodes, prizeLabel } from './loyaltyPolicies';
import { applyLoyaltyRecordFilters, readLoyaltyRecordFilters, nextLoyaltyRecordPage, previousLoyaltyRecordPage, openLoyaltyDetail } from './loyaltyRecordUrl';
import { parseLoyaltyTimeRange, validLoyaltyId } from './loyaltyInputs';

type Kind = 'coupons' | 'attempts' | 'redemptions' | 'movements' | 'versions';
const stateLabels = { RECEIVED: '已接收', VERIFYING: '处理中', REJECTED: '已拒绝', COMPLETED: '已完成' };
const sourceLabels = { CHECK_IN: '每日签到', PROGRESS: '成长进度', REDEMPTION: '兑换', LOTTERY: '抽奖' };
type Field = { key: string; label: string; options?: { label: string; value: string }[]; time?: boolean };
const ids = (...keys: [string, string][]): Field[] => keys.map(([key, label]) => ({ key, label }));
const times: Field[] = [{ key: 'from', label: '开始时间', time: true }, { key: 'to', label: '结束时间（不含）', time: true }];
const state: Field = { key: 'state', label: '处理状态', options: Object.entries(stateLabels).map(([value, label]) => ({ label, value })) };
const fields: Record<Kind, Field[]> = {
  coupons: [...ids(['coupon_id', '优惠券编号'], ['account_id', '账号编号'], ['draw_id', '来源抽奖编号'], ['source_id', '来源编号']), { key: 'coupon_type', label: '券种', options: couponTypes.map((value) => ({ value, label: couponLabels[value] })) }, { key: 'status', label: '券状态', options: [{ value: 'AVAILABLE', label: '可用' }, { value: 'REDEEMED', label: '已兑换' }] }, { key: 'source_kind', label: '来源', options: Object.entries(sourceLabels).map(([value, label]) => ({ value, label })) }, ...times],
  attempts: [...ids(['attempt_id', '尝试编号'], ['draw_id', '抽奖编号'], ['request_id', '请求编号'], ['account_id', '账号编号']), state, { key: 'result_kind', label: '抽奖结果', options: [{ value: 'WIN', label: '中奖' }, { value: 'NO_WIN', label: '谢谢参与' }] }, { key: 'prize_code', label: '奖品', options: prizeCodes.map((value) => ({ value, label: prizeLabel(value) })) }, ...times],
  redemptions: [...ids(['attempt_id', '尝试编号'], ['redemption_id', '兑换编号'], ['coupon_id', '优惠券编号'], ['account_id', '账号编号'], ['request_id', '请求编号']), state, ...times],
  movements: [...ids(['draw_id', '抽奖编号'], ['config_version_id', '配置版本']), { key: 'prize_code', label: '奖品', options: prizeCodes.map((value) => ({ value, label: prizeLabel(value) })) }, { key: 'action', label: '库存动作', options: [{ value: 'TOTAL_ADJUSTED', label: '调整累计总量' }, { value: 'PRIZE_GRANTED', label: '抽奖发放' }] }, ...times],
  versions: [],
};
interface Row { id: string; detailKind: LoyaltyDetailKind; account: string; at: string; type: string; status: string; summary: string; links: { kind: LoyaltyDetailKind; id: string; label: string }[] }
const titles: Record<Kind, string> = { coupons: '优惠券领取记录', attempts: '抽奖尝试记录', redemptions: '发布券兑换尝试', movements: '库存变更记录', versions: '配置保存历史' };
function localTime(value: string) {
  const date = new Date(value); if (!Number.isFinite(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
export function LoyaltyRecords({ kind, configKey }: { kind: Kind; configKey: LoyaltyConfigKey }) {
  const [search, setSearch] = useSearchParams(); const session = useSession(); const services = useAdminServices();
  const read = readLoyaltyRecordFilters(search, fields[kind].map((item) => item.key));
  const [form, setForm] = useState<Record<string, string>>(read.ok ? Object.fromEntries(Object.entries(read.value).map(([key, value]) => [key, key === 'from' || key === 'to' ? localTime(value) : value])) : {}); const [error, setError] = useState('');
  const filter = read.ok ? read.value : {};
  const timeRange = parseLoyaltyTimeRange(filter.from ?? '', filter.to ?? '');
  const invalidField = fields[kind].find((field) => filter[field.key] && (field.options ? !field.options.some((item) => item.value === filter[field.key]) : !field.time && !validLoyaltyId(filter[field.key] ?? '')));
  const valid = read.ok && timeRange.ok && invalidField === undefined;
  const permission = kind === 'versions' ? 'ops.system_config.read' : 'ops.members.read';
  const allowed = hasLoyaltyAccess(session, permission);
  const query = useQuery({ queryKey: ['loyalty-records', session.accountId, kind, configKey, filter], enabled: valid && allowed && services.loyaltyManagement !== undefined, retry: false,
    queryFn: async ({ signal }) => {
      const gateway = services.loyaltyManagement; if (gateway === undefined) throw new Error('记录服务不可用');
      const input = { ...filter, ...(timeRange.ok ? timeRange.value : {}) };
      if (kind === 'coupons') {
        const result = await gateway.coupons(input as CouponFilter, signal);
        return { ...result, items: result.items.map((row): Row => ({ id: row.coupon_id, detailKind: 'coupon', account: row.account_id, at: row.issued_at, type: couponLabels[row.coupon_type], status: row.status === 'AVAILABLE' ? '可用' : '已兑换', summary: `${sourceLabels[row.source_kind]} · ${couponRightsText(row.rights_snapshot)}`, links: [{ kind: 'grant', id: row.source_grant_id, label: '来源发奖' }, { kind: 'config-version', id: row.coupon_config_version_id, label: '领取时配置' }] })) };
      }
      if (kind === 'attempts') {
        const result = await gateway.lotteryAttempts(input as LotteryFilter, signal);
        return { ...result, items: result.items.map((row): Row => ({ id: row.attempt_id, detailKind: 'lottery-attempt', account: row.account_id, at: row.received_at, type: row.result_kind === 'NO_WIN' ? '谢谢参与' : row.result_kind === 'WIN' ? '中奖' : '结果待确认', status: stateLabels[row.state], summary: `抽奖 ${row.draw_id ?? '—'} · 实际消耗 ${row.state === 'REJECTED' ? '0' : row.cost_pink_units ?? '待确认'} 粉钻${row.prize_code === null ? '' : ` · ${prizeLabel(row.prize_code)}`}${row.reason_code === null ? '' : ` · ${row.reason_code}`}`, links: row.result_kind === 'NO_WIN' ? row.pink_spend_entry_id === null ? [] : [{ kind: 'pink-entry', id: row.pink_spend_entry_id, label: '粉钻支出' }] : [
          ...(row.coupon_id === null ? [] : [{ kind: 'coupon' as const, id: row.coupon_id, label: '中奖优惠券' }]), ...(row.pink_reward_entry_id === null ? [] : [{ kind: 'pink-entry' as const, id: row.pink_reward_entry_id, label: '粉钻奖励' }]), ...(row.pink_spend_entry_id === null ? [] : [{ kind: 'pink-entry' as const, id: row.pink_spend_entry_id, label: '粉钻支出' }]), ...(row.inventory_movement_id === null ? [] : [{ kind: 'inventory-movement' as const, id: row.inventory_movement_id, label: '库存变更' }]),
        ] })) };
      }
      if (kind === 'redemptions') {
        const result = await gateway.redemptionAttempts(input as RedemptionFilter, signal);
        return { ...result, items: result.items.map((row): Row => ({ id: row.attempt_id, detailKind: 'redemption-attempt', account: row.account_id, at: row.received_at, type: '发布券固定 1 次', status: stateLabels[row.state], summary: `兑换 ${row.redemption_id ?? '待确认'} · 额度 ${row.available_before_qty ?? '—'} → ${row.available_after_qty ?? '—'}${row.reason_code === null ? '' : ` · ${row.reason_code}`}`, links: [{ kind: 'coupon', id: row.coupon_id, label: '原发布券' }, ...(row.movement_id === null ? [] : [{ kind: 'quota-movement' as const, id: row.movement_id, label: '发布额度账变' }])] })) };
      }
      if (kind === 'movements') {
        const result = await gateway.movements(input as MovementFilter, signal);
        return { ...result, items: result.items.map((row): Row => ({ id: row.movement_id, detailKind: 'inventory-movement', account: row.actor_account_id ?? '—', at: row.occurred_at, type: prizeLabel(row.prize_code), status: row.action === 'TOTAL_ADJUSTED' ? '调整累计总量' : '抽奖发放', summary: `总份数 ${row.before_total_qty} → ${row.after_total_qty} · 已发 ${row.before_issued_qty} → ${row.after_issued_qty}`, links: row.config_version_id === null ? [] : [{ kind: 'config-version', id: row.config_version_id, label: '保存版本' }] })) };
      }
      const result = await gateway.versions(configKey, filter.cursor ?? '', signal);
      return { ...result, items: result.items.map((row): Row => ({ id: row.config_version_id, detailKind: 'config-version', account: row.saved_by, at: row.effective_at, type: row.effective_epoch, status: '已保存并生效', summary: row.reason, links: row.operation_event_id === null ? [] : [{ kind: 'operation-event', id: row.operation_event_id, label: '操作审计' }] })) };
    } });
  const open = (detailKind: LoyaltyDetailKind, id: string) => { const next = openLoyaltyDetail(search, detailKind, id); if (next.ok) setSearch(next.value); };
  const apply = () => {
    for (const field of fields[kind]) if (form[field.key] && (field.options ? !field.options.some((item) => item.value === form[field.key]) : !field.time && !validLoyaltyId(form[field.key] ?? ''))) { setError(`${field.label}格式无效，请填写完整精确编号。`); return; }
    const time = parseLoyaltyTimeRange(form.from ?? '', form.to ?? ''); if (!time.ok) { setError(time.message); return; }
    setError(''); setSearch(applyLoyaltyRecordFilters(search, fields[kind].map((item) => item.key), { ...form, ...time.value }));
  };
  const columns: PrimaryTableCol<Row>[] = [
    { colKey: 'id', title: kind === 'versions' ? '配置版本' : '记录编号', minWidth: 240, cell: ({ row }) => <Button tag="button" variant="text" onClick={() => open(row.detailKind, row.id)}>{row.id}</Button> },
    { colKey: 'account', title: kind === 'versions' || kind === 'movements' ? '操作账号' : '所属账号', minWidth: 200 },
    { colKey: 'type', title: kind === 'versions' ? '生效序号' : '类型／结果', width: 160 }, { colKey: 'status', title: '状态', width: 120 },
    { colKey: 'summary', title: kind === 'versions' ? '保存原因' : '权益／结果说明', minWidth: 320 }, { colKey: 'at', title: '发生时间', width: 200, cell: ({ row }) => formatUTC(row.at) },
    { colKey: 'links', title: '关联记录', minWidth: 230, cell: ({ row }) => <Space breakLine>{row.links.map((link) => <Button key={`${link.kind}:${link.id}`} tag="button" variant="text" onClick={() => open(link.kind, link.id)}>{link.label}</Button>)}</Space> },
  ];
  if (!allowed) return <Alert theme="warning" message={`当前账号没有${titles[kind]}的读取权限。`} />;
  if (services.loyaltyManagement === undefined) return <Alert theme="warning" message="记录服务尚未连接，请使用 API 环境。" />;
  return <AdminListPanel title={titles[kind]} description={query.data ? `数据时间 ${formatUTC(query.data.as_of_at)}` : '按服务端筛选；完整编号可直接打开详情。'}
    filters={fields[kind].length === 0 ? undefined : <ListFilterBar ariaLabel={`${titles[kind]}筛选`} actions={<Space><Button tag="button" theme="primary" disabled={query.isFetching} onClick={apply}>查询</Button><Button tag="button" disabled={query.isFetching} onClick={() => { setForm({}); setError(''); setSearch(applyLoyaltyRecordFilters(search, fields[kind].map((item) => item.key), {})); }}>清空筛选</Button></Space>}>
      {fields[kind].map((field) => <ListFilterField key={field.key} label={field.label}>{field.options ? <Select clearable value={form[field.key] ?? ''} options={field.options} onChange={(value) => setForm({ ...form, [field.key]: String(value ?? '') })} /> : field.time ? <AdminDatePicker type="datetime-local" value={form[field.key] ?? ''} onChange={(nextValue) => setForm({ ...form, [field.key]: nextValue })} /> : <Input value={form[field.key] ?? ''} onChange={(value) => setForm({ ...form, [field.key]: value })} />}</ListFilterField>)}
    </ListFilterBar>}
    pagination={<Space><Button tag="button" disabled={query.isFetching || search.getAll('_previous_cursor').length === 0} onClick={() => setSearch(previousLoyaltyRecordPage(search))}>上一页</Button><Button tag="button" disabled={query.isFetching || query.data?.page.next_cursor == null} onClick={() => setSearch(nextLoyaltyRecordPage(search, query.data?.page.next_cursor ?? null))}>下一页</Button><Button tag="button" disabled={query.isFetching} onClick={() => void query.refetch()}>刷新记录</Button></Space>}>
    {error || !valid ? <div role="alert"><Alert theme="error" message={error || (!read.ok ? read.message : !timeRange.ok ? timeRange.message : 'URL 筛选条件无效，请重新查询。')} /></div> : null}
    {!valid ? null : query.isError ? <Alert theme="error" message={`记录读取失败：${loyaltyFailure(query.error).message}`} operation={<Button tag="button" onClick={() => void query.refetch()}>重试</Button>} /> : <Table rowKey="id" data={query.data?.items ?? []} columns={columns} loading={query.isPending} empty="没有符合筛选条件的记录" stripe hover />}
  </AdminListPanel>;
}
