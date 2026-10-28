import { AdminDatePicker } from '../../shared/ui/AdminDatePicker';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Input, Select, Space, Table, Tag, type PrimaryTableCol } from 'tdesign-react';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';
import type { IAMAuditFilter } from '../../shared/services/contracts';
import { PageHeader } from '../../shared/ui/PageHeader';
import { AdminListPanel } from '../../shared/ui/AdminListPanel';
import { ListFilterBar, ListFilterField } from '../../shared/ui/ListFilterBar';
import { formatUTC } from '../../shared/format/time';
import './settings.css';
import { LoyaltyDetailDrawer } from '../loyalty/LoyaltyDetailDrawer';
import { openLoyaltyDetail } from '../loyalty/loyaltyRecordUrl';
import { hasLoyaltyAccess } from '../loyalty/loyaltyAccess';

type Kind = 'login' | 'operation';
type Row = { id: string; at: string; actor: string; name: string; roles: readonly string[]; action: string; result: string; completedLottery: boolean; source: string; object: string; detail: string };
type Form = { keyword: string; object: string; action: string; method: '' | 'SMS_OTP' | 'QR_CHALLENGE'; result: '' | 'SUCCESS' | 'FAILED'; from: string; to: string; size: number };
const initial: Form = { keyword: '', object: '', action: '', method: '', result: '', from: '', to: '', size: 20 };
const roles: Record<string, string> = { 'ops.super_admin': '超级管理员', 'ops.operations': '运营', 'ops.after_sales': '售后', 'ops.finance': '财务' };
export function LoginLogsSettingsPage() { return <AuditPage kind="login" />; }
export function OperationLogsSettingsPage() { return <AuditPage kind="operation" />; }
function AuditPage({ kind }: { kind: Kind }) {
  const session = useSession(); const services = useAdminServices();
  const [search, setSearch] = useSearchParams();
  const objectKeyword = kind === 'operation' ? search.get('object_keyword') ?? '' : '';
  const [form, setForm] = useState<Form>({ ...initial, object: objectKeyword });
  const [filters, setFilters] = useState<IAMAuditFilter>(kind === 'login' ? { audience: 'OPS' } : objectKeyword === '' ? {} : { object_keyword: objectKeyword });
  const [cursors, setCursors] = useState(['']); const [error, setError] = useState('');
  const cursor = cursors.at(-1) ?? '';
  const allowed = session.permissions.includes('ops.audit.read');
  const query = useQuery({ queryKey: ['iam-audit', session.accountId, kind, filters, cursor], enabled: allowed && services.iam !== undefined, retry: false,
    queryFn: async ({ signal }) => {
      if (!services.iam) throw new Error('审计 API 未接入');
      if (kind === 'login') {
        const data = await services.iam.listLoginEvents(cursor, { signal }, filters);
        return { page: data.page, items: data.items.map((e): Row => ({ id: e.event_id, at: e.occurred_at, actor: e.account_id ?? '未关联账号', name: e.current_display_name ?? e.account_id ?? '未关联账号', roles: e.current_roles ?? [], action: e.login_method === 'SMS_OTP' ? '手机号验证码' : e.login_method === 'QR_CHALLENGE' ? '小程序扫码' : e.login_method, result: e.result_code, completedLottery: false, source: e.provider_code, object: '', detail: e.result_code === 'SUCCESS' ? '—' : e.result_code })) };
      }
      const data = await services.iam.listOperationEvents(cursor, { signal }, filters);
      return { page: data.page, items: data.items.map((e): Row => ({ id: e.event_id, at: e.occurred_at, actor: e.actor_account_id, name: e.current_display_name ?? e.actor_account_id, roles: [], action: e.action_code, result: e.result_code, completedLottery: e.operation_id === 'loyalty.lottery.draw' && e.action_code === 'EXECUTE' && 'http_status' in e && e.http_status === 201 && (e.result_code === 'WIN' || e.result_code === 'NO_WIN'), source: e.operation_id, object: `${e.resource_type ?? '系统'} / ${e.resource_id ?? '—'}`, detail: JSON.stringify(e.field_change_summary) })) };
    } });
  const apply = () => {
    const from = form.from === '' ? undefined : new Date(form.from); const to = form.to === '' ? undefined : new Date(form.to);
    if (from && !Number.isFinite(from.getTime()) || to && !Number.isFinite(to.getTime()) || from && to && from >= to) { setError('请输入有效的时间范围，结束时间须晚于开始时间。'); return; }
    const next: IAMAuditFilter = { page_size: form.size };
    if (kind === 'login') { next.audience = 'OPS'; if (form.method) next.login_method = form.method; }
    else { if (form.object.trim()) next.object_keyword = form.object.trim(); if (form.action.trim()) next.action_code = form.action.trim(); }
    if (form.keyword.trim()) next.keyword = form.keyword.trim(); if (form.result) next.result_class = form.result;
    if (from) next.from = from.toISOString(); if (to) next.to = to.toISOString();
    setError(''); setFilters(next); setCursors(['']);
    if (kind === 'operation') { const url = new URLSearchParams(search); url.delete('object_keyword'); if (next.object_keyword) url.set('object_keyword', next.object_keyword); setSearch(url); }
  };
  const columns: PrimaryTableCol<Row>[] = [
    ...(kind === 'operation' ? [{ colKey: 'id', title: '精确事件编号', minWidth: 240, cell: ({ row }: { row: Row }) => hasLoyaltyAccess(session, 'ops.audit.read') ? <Button tag="button" variant="text" onClick={() => { const next = openLoyaltyDetail(search, 'operation-event', row.id); if (next.ok) setSearch(next.value); }}>{row.id}</Button> : row.id }] : []),
    { colKey: 'at', title: kind === 'login' ? '登录时间' : '发生时间', width: 200, cell: ({ row }) => formatUTC(row.at) },
    { colKey: 'actor', title: kind === 'login' ? '管理员（当前名称）' : '操作人（当前名称）', width: 230, cell: ({ row }) => <div className="table-primary"><strong>{row.name}</strong><small>{row.actor}</small></div> },
    ...(kind === 'login' ? [{ colKey: 'roles', title: '当前角色', width: 150, cell: ({ row }: { row: Row }) => row.roles.map((r) => roles[r] ?? r).join('、') || '未关联后台身份' }] : []),
    { colKey: 'action', title: kind === 'login' ? '登录方式' : '操作动作', width: 160 },
    { colKey: 'source', title: kind === 'login' ? '来源' : '操作接口', width: 200 },
    ...(kind === 'operation' ? [{ colKey: 'object', title: '业务对象', width: 260 }] : []),
    { colKey: 'result', title: '结果', width: kind === 'operation' ? 140 : 100, cell: ({ row }) => <Tag theme={row.result === 'SUCCESS' || row.completedLottery ? 'success' : 'danger'}>{row.completedLottery ? row.result === 'WIN' ? '完成（中奖）' : '完成（未中奖）' : row.result === 'SUCCESS' ? '成功' : '失败'}</Tag> },
    { colKey: 'detail', title: kind === 'login' ? '结果说明' : '脱敏变更内容', minWidth: 260 },
  ];
  const pageHeader = <PageHeader title={kind === 'login' ? '登录日志' : '操作日志'} description="按服务端筛选和游标翻页；姓名与角色展示当前资料，事件保留发生时的账号标识。" />;
  if (!allowed) return <div>{pageHeader}<Alert theme="warning" message="当前账号没有审计读取权限" /></div>;
  if (!services.iam) return <div>{pageHeader}<Alert theme="warning" message="请切换至 API 环境读取审计记录" /></div>;
  return <div><PageHeader title={kind === 'login' ? '登录日志' : '操作日志'} description="按服务端筛选和游标翻页；姓名与角色展示当前资料，事件保留发生时的账号标识。" />
    <AdminListPanel title={kind === 'login' ? '登录记录' : '操作审计记录'} density="log" filters={<ListFilterBar ariaLabel="审计筛选" summary="筛选全部服务端记录" actions={<Space><Button tag="button" onClick={apply}>查询</Button><Button tag="button" onClick={() => { setForm(initial); setFilters(kind === 'login' ? { audience: 'OPS' } : {}); setCursors(['']); setError(''); }}>重置</Button></Space>}>
      <ListFilterField label={kind === 'login' ? '关键词' : '操作人'} wide><Input value={form.keyword} maxlength={80} onChange={(keyword) => setForm({ ...form, keyword })} placeholder={kind === 'login' ? '管理员、账号或来源' : '管理员姓名或账号'} /></ListFilterField>
      {kind === 'login' ? <ListFilterField label="登录方式"><Select clearable value={form.method} options={[{ label: '手机号验证码', value: 'SMS_OTP' }, { label: '小程序扫码', value: 'QR_CHALLENGE' }]} onChange={(v) => setForm({ ...form, method: v === 'SMS_OTP' || v === 'QR_CHALLENGE' ? v : '' })} /></ListFilterField> : <><ListFilterField label="操作动作"><Input value={form.action} maxlength={64} onChange={(action) => setForm({ ...form, action })} placeholder="例如 CREATE" /></ListFilterField><ListFilterField label="业务对象"><Input value={form.object} maxlength={80} onChange={(object) => setForm({ ...form, object })} placeholder="类型或编号" /></ListFilterField></>}
      <ListFilterField label="结果"><Select clearable value={form.result} options={[{ label: '成功', value: 'SUCCESS' }, { label: '失败', value: 'FAILED' }]} onChange={(v) => setForm({ ...form, result: v === 'SUCCESS' || v === 'FAILED' ? v : '' })} /></ListFilterField>
      <ListFilterField label="开始时间"><AdminDatePicker aria-label="开始时间" type="datetime-local" value={form.from} onChange={(nextValue) => setForm({ ...form, from: nextValue })} /></ListFilterField><ListFilterField label="结束时间（不含）"><AdminDatePicker aria-label="结束时间" type="datetime-local" value={form.to} onChange={(nextValue) => setForm({ ...form, to: nextValue })} /></ListFilterField>
      <ListFilterField label="每页条数"><Select value={form.size} options={[5, 10, 20].map((value) => ({ label: String(value), value }))} onChange={(v) => setForm({ ...form, size: Number(v) })} /></ListFilterField>
    </ListFilterBar>} pagination={<Space><span>本页 {query.data?.items.length ?? 0} 条</span><Button tag="button" disabled={query.isFetching || cursors.length < 2} onClick={() => setCursors(cursors.slice(0, -1))}>上一页</Button><Button tag="button" disabled={query.isFetching || !query.data?.page.has_more} onClick={() => { const next = query.data?.page.next_cursor; if (next) setCursors([...cursors, next]); }}>下一页</Button><Button tag="button" disabled={query.isFetching} onClick={() => { setCursors(['']); void query.refetch(); }}>刷新记录</Button></Space>}>
      {error ? <Alert theme="error" message={error} /> : null}
      {query.isError ? <Alert theme="error" message="日志读取失败，请重试。" operation={<Button onClick={() => void query.refetch()}>重试</Button>} /> : <Table rowKey="id" data={query.data?.items ?? []} columns={columns} loading={query.isPending} stripe hover empty="没有符合筛选条件的记录" />}
    </AdminListPanel>
    {kind === 'operation' ? <LoyaltyDetailDrawer /> : null}
  </div>;
}
