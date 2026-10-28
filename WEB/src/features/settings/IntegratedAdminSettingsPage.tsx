import { randomId } from '../../shared/randomId';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Alert, Avatar, Button, Input, MessagePlugin, Select, Space, Table, Tag, type PrimaryTableCol } from 'tdesign-react';
import { AddIcon } from 'tdesign-icons-react';
import { useSession } from '../../shared/access/session';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { useAdminServices, type IAMAccountProjection } from '../../shared/services';
import { configurationFailureMessage, isDefinitiveSettingsRejection } from '../../shared/services/createIntegratedAdminServices';
import { formatUTC } from '../../shared/format/time';
import { AdminListPanel } from '../../shared/ui/AdminListPanel';
import { AdminAsyncState } from '../../shared/ui/AdminAsyncState';
import { classifyAdminAsyncError } from '../../shared/ui/adminAsyncStateModel';
import { AdminActionConfirm } from '../../shared/ui/AdminActionConfirm';
import { ListFilterBar, ListFilterField } from '../../shared/ui/ListFilterBar';
import { PageHeader } from '../../shared/ui/PageHeader';
import { IntegratedAdminAccountEditor } from './IntegratedAdminAccountEditor';
import { opsRoleLabels } from './opsRoles';

type Lifecycle = { account: IAMAccountProjection; action: 'deactivate' | 'reactivate' | 'archive'; key: string };
const statuses = { ACTIVE: '正常', DISABLED: '已禁用', ARCHIVED: '已归档' };
const actions = { deactivate: '禁用', reactivate: '启用', archive: '删除并归档' };

export function IntegratedAdminSettingsPage() {
  const services = useAdminServices();
  const session = useSession();
  const keys = useAdminQueryKeys();
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const cursor = params.get('iam_cursor') ?? '';
  const filter = { keyword: params.get('keyword') ?? '', role: params.get('role') ?? '', status: params.get('status') ?? '', wechat_status: params.get('wechat_status') ?? '' };
  const canRead = session.accessToken !== null && session.permissions.includes('ops.accounts.read');
  const canManage = session.permissions.includes('ops.roles.assign') && services.iam?.accounts !== undefined;
  const [editing, setEditing] = useState<IAMAccountProjection | null | undefined>(undefined);
  const [lifecycle, setLifecycle] = useState<Lifecycle | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accounts = useQuery({ queryKey: keys.resource('iam', 'accounts', filter, cursor), enabled: canRead, retry: false,
    queryFn: ({ signal }) => { if (!services.iam) throw new Error('管理员服务不可用'); return services.iam.listAccounts(cursor, { signal }, filter); } });
  const roles = useQuery({ queryKey: keys.resource('iam', 'roles'), enabled: canRead && session.permissions.includes('ops.roles.read'), retry: false,
    queryFn: ({ signal }) => { if (!services.iam) throw new Error('角色服务不可用'); return services.iam.listRoles({ signal }); } });
  const change = useMutation({ mutationFn: async () => {
    if (lifecycle === null || !services.iam?.accounts) throw new Error('管理员服务不可用');
    return services.iam.accounts.changeStatus(lifecycle.account, lifecycle.action, `后台人工${actions[lifecycle.action]}`, lifecycle.key);
  }, onSuccess: async () => {
    setLifecycle(null); setUncertain(false); setError(null);
    await client.invalidateQueries({ queryKey: keys.domain('iam') });
    await MessagePlugin.success('管理员状态已更新');
  }, onError: (failure) => {
    const definitive = isDefinitiveSettingsRejection(failure);
    setUncertain(!definitive);
    setError(definitive ? configurationFailureMessage(failure) : '状态更新结果尚未确认，请重试原请求。');
    if (definitive) setLifecycle(null);
  } });
  const updateParams = (patch: Record<string, string>, reset = true) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (reset) next.delete('iam_cursor');
    for (const [key, value] of Object.entries(patch)) { if (value === '') next.delete(key); else next.set(key, value); }
    return next;
  });
  const requestAction = (account: IAMAccountProjection, action: Lifecycle['action']) => { setError(null); setUncertain(false); setLifecycle({ account, action, key: randomId() }); };
  const columns: PrimaryTableCol<IAMAccountProjection>[] = [
    { colKey: 'display_name', title: '管理员', width: 190, cell: ({ row }) => <div className="table-primary"><strong>{row.display_name}</strong><small className="mono-value">{row.account_id}</small></div> },
    { colKey: 'phone_masked', title: '手机号', width: 140, cell: ({ row }) => row.phone_masked ?? '未配置' },
    { colKey: 'wechat', title: '微信账号', width: 190, cell: ({ row }) => <div className="admin-wechat-cell"><Avatar size="32px">{(row.wechat_binding?.nickname ?? row.display_name).slice(0, 1)}</Avatar><span>{row.wechat_binding?.status === 'BOUND' ? row.wechat_binding.nickname || '已绑定' : '未绑定'}</span></div> },
    { colKey: 'roles', title: '角色', width: 150, cell: ({ row }) => row.roles.map((code) => <Tag key={code} variant="light">{opsRoleLabels[code] ?? code}</Tag>) },
    { colKey: 'status', title: '状态', width: 110, cell: ({ row }) => <Tag variant="light" theme={row.status === 'ACTIVE' ? 'success' : 'danger'}>{statuses[row.status]}</Tag> },
    { colKey: 'last_login_at', title: '最近登录', width: 180, cell: ({ row }) => row.last_login_at ? formatUTC(row.last_login_at) : '尚未登录' },
    { colKey: 'actions', title: '操作', width: 210, fixed: 'right', cell: ({ row }) => canManage && row.account_id !== session.accountId ? <Space size="small">
      {row.status !== 'ARCHIVED' && <Button variant="text" disabled={!roles.data || roles.isError} onClick={() => setEditing(row)}>编辑</Button>}
      <Button variant="text" onClick={() => requestAction(row, row.status === 'ACTIVE' ? 'deactivate' : 'reactivate')}>{row.status === 'ACTIVE' ? '禁用' : '启用'}</Button>
      {row.status !== 'ARCHIVED' && <Button theme="danger" variant="text" onClick={() => requestAction(row, 'archive')}>删除</Button>}
    </Space> : '—' },
  ];
  if (!canRead) return <Alert theme="warning" message="当前会话没有管理员列表读取权限。" />;
  return <div>
    <PageHeader title="管理员管理" description="管理后台成员、角色、账号状态和微信绑定。" actions={canManage && <Button theme="primary" icon={<AddIcon />} disabled={!roles.data || roles.isError} onClick={() => setEditing(null)}>新增管理员</Button>} />
    {error !== null && <Alert theme="error" message={error} />}
    {roles.isError && <Alert theme="error" message="角色读取失败，暂时无法编辑管理员。" />}
    <AdminListPanel title="管理员列表" filters={<ListFilterBar ariaLabel="管理员筛选" summary={`本页 ${accounts.data?.items.length ?? 0} 名管理员`} actions={<Button size="small" variant="outline" onClick={() => setParams({})}>重置</Button>}>
      <ListFilterField label="关键词" wide><Input clearable placeholder="姓名、账号或完整手机号" value={filter.keyword} onChange={(keyword) => updateParams({ keyword })} /></ListFilterField>
      <ListFilterField label="角色"><Select clearable placeholder="全部角色" value={filter.role} options={Object.entries(opsRoleLabels).map(([value, label]) => ({ value, label }))} onChange={(role) => updateParams({ role: role == null ? '' : String(role) })} /></ListFilterField>
      <ListFilterField label="状态"><Select clearable placeholder="正常与已禁用" value={filter.status} options={Object.entries(statuses).map(([value, label]) => ({ value, label }))} onChange={(status) => updateParams({ status: status == null ? '' : String(status) })} /></ListFilterField>
      <ListFilterField label="微信绑定"><Select clearable placeholder="全部" value={filter.wechat_status} options={[{ label: '已绑定', value: 'BOUND' }, { label: '未绑定', value: 'UNBOUND' }]} onChange={(value) => updateParams({ wechat_status: value == null ? '' : String(value) })} /></ListFilterField>
    </ListFilterBar>} pagination={<Space><Button disabled={cursor === '' || accounts.isFetching} onClick={() => updateParams({ iam_cursor: '' }, false)}>第一页</Button><Button disabled={accounts.isFetching || accounts.isError || !accounts.data?.page.has_more || !accounts.data.page.next_cursor} onClick={() => updateParams({ iam_cursor: accounts.data?.page.next_cursor ?? '' }, false)}>下一页</Button><Button disabled={accounts.isFetching} onClick={() => void accounts.refetch()}>刷新</Button></Space>}>
      {accounts.isError ? <AdminAsyncState kind={classifyAdminAsyncError(accounts.error)} title="管理员列表加载失败" actionLabel="重新加载" onAction={() => void accounts.refetch()} /> : <Table rowKey="account_id" data={accounts.data?.items ?? []} columns={columns} loading={accounts.isFetching} hover empty="没有符合筛选条件的管理员" />}
    </AdminListPanel>
    {editing !== undefined && roles.data && <IntegratedAdminAccountEditor key={`${session.accountId}:${session.permissions.join(',')}:${editing?.account_id ?? 'new'}`} account={editing} roles={roles.data} onClose={() => setEditing(undefined)} />}
    {lifecycle !== null && <AdminActionConfirm visible title={`${actions[lifecycle.action]}管理员`} objectLabel={lifecycle.account.display_name} actionLabel={actions[lifecycle.action]} impact="只调整后台身份，保留角色权限和历史记录；禁用或归档会撤销后台会话，小程序身份不受影响。" recoverable confirmText={uncertain ? '重试原请求' : '确认操作'} pending={change.isPending} onCancel={() => { if (!change.isPending && !uncertain) setLifecycle(null); }} onConfirm={() => change.mutate()} />}
  </div>;
}
