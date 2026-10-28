import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Input, Select, Space, Table, Tag, type PrimaryTableCol } from 'tdesign-react';
import { useNavigate } from 'react-router-dom';
import { formatFen } from '../../shared/format/money';
import { formatUTC } from '../../shared/format/time';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { useAdminServices, type MemberSummary } from '../../shared/services';
import { AdminListPanel } from '../../shared/ui/AdminListPanel';
import { ListFilterBar, ListFilterField } from '../../shared/ui/ListFilterBar';
import { ListPagination } from '../../shared/ui/ListPagination';
import { PageHeader } from '../../shared/ui/PageHeader';
import { paginateListRows, useListParams } from '../../shared/ui/useListParams';
import './membership.css';

const realNameOptions = [
  { label: '已实名', value: 'VERIFIED' },
  { label: '未实名', value: 'UNVERIFIED' },
];

export function MembershipPage() {
  const services = useAdminServices();
  const queryKeys = useAdminQueryKeys();
  const navigate = useNavigate();
  const membersQuery = useQuery({ queryKey: queryKeys.resource('members', 'list'), queryFn: ({ signal }) => services.members.list({ signal }), refetchInterval: 5000, refetchIntervalInBackground: false });
  const list = useListParams({ defaultPageSize: 10 });
  const keyword = list.get('keyword').trim().toLocaleLowerCase('zh-CN');
  const realNameStatus = list.get('realNameStatus');
  const filtered = useMemo(() => (membersQuery.data ?? []).filter((member) => {
    const matchesKeyword = keyword === '' || [member.nickname, member.userId, member.mobileMasked, member.miniProgramOpenIdMasked]
      .some((value) => value.toLocaleLowerCase('zh-CN').includes(keyword));
    return matchesKeyword && (realNameStatus === '' || member.realNameStatus === realNameStatus);
  }), [keyword, membersQuery.data, realNameStatus]);
  const page = paginateListRows(filtered, list.page, list.pageSize);

  const columns: PrimaryTableCol<MemberSummary>[] = [
    {
      colKey: 'nickname', title: '小程序用户', width: 260,
      cell: ({ row }) => <div className="member-identity"><img src={row.avatarUrl} alt="" /><div><strong>{row.nickname}</strong><small className="mono-value">{row.userId}</small></div></div>,
    },
    {
      colKey: 'miniProgramOpenIdMasked', title: '小程序信息', width: 220,
      cell: ({ row }) => <div className="table-primary"><strong className="mono-value">{row.miniProgramOpenIdMasked}</strong><small>注册于 {formatUTC(row.miniProgramRegisteredAt)}</small></div>,
    },
    {
      colKey: 'consumptionAmountFen', title: '有效消费', width: 170, align: 'right',
      cell: ({ row }) => <div className="table-primary table-primary--right"><strong className="money-value">{row.consumptionAmountFen === null ? '未接入' : formatFen(row.consumptionAmountFen)}</strong><small>{row.consumptionOrderCount === null ? '消费次数未接入' : `${row.consumptionOrderCount} 次有效消费`}</small></div>,
    },
    {
      colKey: 'realNameStatus', title: '实名状态', width: 110,
      cell: ({ row }) => <Tag theme={row.realNameStatus === 'VERIFIED' ? 'success' : 'warning'} variant="light">{row.realNameStatus === 'VERIFIED' ? '已实名' : '未实名'}</Tag>,
    },
    {
      colKey: 'wechatPayScoreRaw', title: '微信支付分', width: 160,
      cell: ({ row }) => <div className="table-primary"><strong>{row.wechatPayScoreRaw ?? '—'}</strong><small>{row.wechatPayScoreUpdatedAt === null ? '未更新' : formatUTC(row.wechatPayScoreUpdatedAt)}</small></div>,
    },
    { colKey: 'mobileMasked', title: '手机号', width: 150, cell: ({ row }) => <span className="mono-value">{row.mobileMasked}</span> },
    {
      colKey: 'operation', title: '操作', fixed: 'right', width: 110,
      cell: ({ row }) => <Button size="small" variant="outline" onClick={() => navigate(`/membership/${encodeURIComponent(row.userId)}`)}>用户档案</Button>,
    },
  ];

  return <div>
    <PageHeader title="用户与会员" description="回显小程序用户、实名状态与微信支付分原始分值；消费统计未接入时明确显示空态。" />
    <AdminListPanel
      title="会员用户"
      count={filtered.length}
      filters={membersQuery.isError ? undefined : <ListFilterBar
        ariaLabel="会员筛选"
        summary={`共 ${filtered.length} 名会员`}
        actions={<Button size="small" variant="outline" onClick={list.resetFilters}>重置</Button>}
      >
        <ListFilterField label="用户" wide><Input clearable placeholder="昵称、用户 ID、手机号或 OpenID" value={list.get('keyword')} onChange={(value) => list.setFilters({ keyword: value })} /></ListFilterField>
        <ListFilterField label="实名状态"><Select clearable placeholder="全部状态" options={realNameOptions} value={realNameStatus} onChange={(value) => list.setFilters({ realNameStatus: value == null ? null : String(value) })} /></ListFilterField>
      </ListFilterBar>}
      pagination={membersQuery.isError ? undefined : <ListPagination current={page.current} pageSize={page.pageSize} total={page.total} onChange={(current, pageSize) => list.update({ page: current, pageSize })} ariaLabel="会员分页" />}
    >
      {membersQuery.isError ? <Alert theme="error" closeBtn={false} message={<Space>会员信息加载失败<Button size="small" variant="outline" onClick={() => void membersQuery.refetch()}>重新加载</Button></Space>} /> :
        <Table rowKey="userId" data={page.rows} columns={columns} loading={membersQuery.isLoading} hover tableLayout="fixed" empty="暂无会员" />}
    </AdminListPanel>
  </div>;
}
