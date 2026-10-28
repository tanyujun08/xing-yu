import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Input, Table, Tag, type PrimaryTableCol } from 'tdesign-react';
import { AdminListPanel } from '../../shared/ui/AdminListPanel';
import { ListFilterBar, ListFilterField } from '../../shared/ui/ListFilterBar';
import { ListPagination } from '../../shared/ui/ListPagination';
import { PageHeader } from '../../shared/ui/PageHeader';
import { useListParams } from '../../shared/ui/useListParams';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { useAdminServices, type IAMRoleProjection } from '../../shared/services';
import { useSession } from '../../shared/access/session';
import { AdminAsyncState } from '../../shared/ui/AdminAsyncState';
import { classifyAdminAsyncError } from '../../shared/ui/adminAsyncStateModel';
import { RolePermissionsEditor } from './RolePermissionsEditor';
import {
  filterRoles,
  paginateRows,
  PERMISSION_LABELS,
  type RoleProjection,
} from './settingsProjections';
import './settings.css';

export function RolesSettingsPage() {
	const services = useAdminServices();
	const session = useSession();
	const [editing, setEditing] = useState<IAMRoleProjection | null>(null);
	const queryKeys = useAdminQueryKeys();
	const rolesQuery = useQuery({
		queryKey: queryKeys.resource('iam', 'roles'),
		queryFn: ({ signal }) => services.iam?.listRoles({ signal }) ?? Promise.resolve([]),
		enabled: services.iam !== undefined,
	});
	const roleRows = useMemo<RoleProjection[]>(() => (rolesQuery.data ?? []).map((role) => ({
			role: role.role_code,
			label: ({ 'ops.super_admin': '超级管理员', 'ops.operations': '运营', 'ops.after_sales': '售后', 'ops.finance': '财务' } as Record<string, string>)[role.role_code] ?? role.role_code,
			description: role.status === 'ACTIVE' ? '由 IAM 服务返回的生效角色' : '已停用角色',
			permissions: role.permissions,
		})), [rolesQuery.data]);
  const list = useListParams({ defaultPageSize: 10, pageSizeOptions: [5, 10, 20] });
  const keyword = list.get('keyword');
  const filtered = useMemo(() => filterRoles(roleRows, keyword), [keyword, roleRows]);
  const page = paginateRows(filtered, list.page, list.pageSize);

  const columns: PrimaryTableCol<RoleProjection>[] = [
    {
      colKey: 'role',
      title: '角色',
      width: 260,
      cell: ({ row }) => (
        <div className="table-primary">
          <strong>{row.label}</strong>
          <small className="mono-value">{row.role}</small>
        </div>
      ),
    },
    { colKey: 'description', title: '职责说明', width: 320, ellipsis: true },
    {
      colKey: 'permissions',
      title: '权限投影',
      minWidth: 720,
      cell: ({ row }) => (
        <div className="settings-permission-list">
          {row.permissions.map((permission) => (
            <Tag key={permission} variant="light">{PERMISSION_LABELS[permission] ?? permission}</Tag>
          ))}
        </div>
      ),
    },
    { colKey: 'count', title: '权限数', width: 100, align: 'right', cell: ({ row }) => row.permissions.length },
    ...(services.iam?.replaceRolePermissions !== undefined && session.permissions.includes('ops.roles.assign') ? [{ colKey: 'actions', title: '操作', width: 140, cell: ({ row }: { row: RoleProjection }) => <Button variant="text" onClick={() => { const source = rolesQuery.data?.find((candidate) => candidate.role_code === row.role); if (source !== undefined) setEditing(source); }}>配置权限</Button> }] : []),
  ];

  if (!services.iam) return <Alert theme="warning" message="请切换至 API 环境读取角色权限" />;
  return (
    <div>
      <PageHeader
        title="角色管理"
        description="查看各角色的职责和权限范围。"
      />

      <AdminListPanel
        title="角色与权限矩阵"
        count={filtered.length}
        countLabel="个角色"
        filters={(
          <ListFilterBar
            ariaLabel="角色筛选"
            summary={`共 ${filtered.length} 个角色`}
            actions={<Button size="small" variant="outline" onClick={list.resetFilters}>重置</Button>}
          >
            <ListFilterField label="关键词" wide>
              <Input clearable placeholder="角色、职责或权限" value={keyword} onChange={(value) => list.setFilters({ keyword: value })} />
            </ListFilterField>
          </ListFilterBar>
        )}
        pagination={<ListPagination current={page.current} pageSize={page.pageSize} pageSizeOptions={[5, 10, 20]} total={page.total} onChange={(current, pageSize) => list.update({ page: current, pageSize })} ariaLabel="角色分页" />}
      >
        {rolesQuery.isError ? <AdminAsyncState kind={classifyAdminAsyncError(rolesQuery.error)} title="角色加载失败" actionLabel="重新加载" onAction={() => void rolesQuery.refetch()} /> : <Table rowKey="role" data={page.rows} columns={columns} loading={rolesQuery.isLoading} hover empty="没有符合筛选条件的角色" />}
      </AdminListPanel>
      {editing !== null && <RolePermissionsEditor key={`${session.accountId}:${session.permissions.join(',')}:${editing.role_id}`} role={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
