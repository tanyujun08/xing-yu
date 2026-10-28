import { AdminDatePicker } from '../../shared/ui/AdminDatePicker';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Alert, Button, Drawer, Select, Space } from 'tdesign-react';
import { formatUTC } from '../../shared/format/time';
import type { CabinetManagementGateway, CabinetProviderOperation, CabinetProviderOperationFilter } from '../../shared/services/cabinetManagement';
import { StatusTag } from '../../shared/ui/StatusTag';
import { cabinetCommandResultLabel } from './cabinetCommandPresentation';

const kindLabels: Record<NonNullable<CabinetProviderOperationFilter['kind']>, string> = {
  '': '全部类型', ONLINE_QUERY: '在线查询', DOOR_QUERY: '箱门查询', OPEN_ONE: '单格开门', OPEN_ALL: '管理员全开',
};
const statusLabels: Record<NonNullable<CabinetProviderOperationFilter['status']>, string> = {
  '': '全部状态', QUEUED: '排队中', RUNNING: '执行中', ACCEPTED: '调用成功', SUCCEEDED: '查询成功', FAILED: '失败', UNKNOWN: '待核对',
};
const dateStart = (date: string) => date ? new Date(`${date}T00:00:00`).toISOString() : '';
const dateEnd = (date: string) => date ? new Date(`${date}T23:59:59.999`).toISOString() : '';

export function CabinetProviderOperationsPanel({ cabinetId, gateway, accountId, visible }: {
  cabinetId: string;
  gateway: CabinetManagementGateway;
  accountId: string | null;
  visible: boolean;
}) {
  const [kind, setKind] = useState<NonNullable<CabinetProviderOperationFilter['kind']>>('');
  const [status, setStatus] = useState<NonNullable<CabinetProviderOperationFilter['status']>>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cursor, setCursor] = useState('');
  const [selected, setSelected] = useState<CabinetProviderOperation | null>(null);
  const resetPage = () => { setCursor(''); setSelected(null); };
  const invalidRange = from !== '' && to !== '' && from > to;
  const filter = { kind, status, createdFrom: dateStart(from), createdTo: dateEnd(to), cursor };
  const page = useQuery({
    queryKey: ['cabinet-management', accountId, 'provider-operations', cabinetId, filter],
    queryFn: ({ signal }) => gateway.providerOperations(cabinetId, filter, { signal }),
    enabled: visible && !invalidRange,
    retry: false,
    refetchInterval: visible ? 15000 : false,
    refetchIntervalInBackground: false,
  });
  const query = useQuery({
    queryKey: ['cabinet-management', accountId, 'provider-query-detail', cabinetId, selected?.operation_id],
    queryFn: ({ signal }) => gateway.providerQuery(cabinetId, selected!.operation_id, { signal }),
    enabled: visible && selected !== null && selected.kind.endsWith('_QUERY'), retry: false,
    refetchInterval: (current) => visible && selected !== null && (!current.state.data || current.state.data.status === 'QUEUED' || current.state.data.status === 'RUNNING') ? 3000 : false,
    refetchIntervalInBackground: false,
  });
  const command = useQuery({
    queryKey: ['cabinet-management', accountId, 'provider-command-detail', selected?.operation_id],
    queryFn: ({ signal }) => gateway.command(selected!.operation_id, { signal }),
    enabled: visible && selected !== null && !selected.kind.endsWith('_QUERY'), retry: false,
    refetchInterval: (current) => visible && selected !== null && (!current.state.data || current.state.data.execution_status === 'REQUESTED' || current.state.data.execution_status === 'DISPATCHING') ? 3000 : false,
    refetchIntervalInBackground: false,
  });
  return <section className="cabinet-provider-history" aria-label="千鸣操作记录">
    <div className="cabinet-section-heading"><div><h3>千鸣操作记录</h3><p>开门接口返回成功即显示调用成功，实际门态通过独立查询更新。可按原记录核对操作与查询结果。</p></div><Button variant="outline" disabled={page.isFetching} onClick={() => void page.refetch()}>刷新记录</Button></div>
    <div className="cabinet-provider-history__filters">
      <Select aria-label="操作类型" value={kind} options={Object.entries(kindLabels).map(([value, label]) => ({ value, label }))} onChange={(value) => { setKind(String(value) as NonNullable<CabinetProviderOperationFilter['kind']>); resetPage(); }} />
      <Select aria-label="请求状态" value={status} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} onChange={(value) => { setStatus(String(value) as NonNullable<CabinetProviderOperationFilter['status']>); resetPage(); }} />
      <label>开始日期 <AdminDatePicker type="date" value={from} onChange={(nextValue) => { setFrom(nextValue); resetPage(); }} /></label>
      <label>结束日期 <AdminDatePicker type="date" value={to} onChange={(nextValue) => { setTo(nextValue); resetPage(); }} /></label>
    </div>
    {invalidRange && <Alert theme="warning" message="结束日期不能早于开始日期。" />}
    {page.isLoading && <p role="status">正在读取千鸣操作记录…</p>}
    {page.isError && <Alert theme="error" message="操作记录读取失败，请刷新后再核对。" />}
    {!page.isLoading && !page.isError && page.data?.items.length === 0 && <p className="cabinet-empty">当前条件下暂无操作记录</p>}
    {(page.data?.items.length ?? 0) > 0 && <div className="cabinet-stockings__table-wrap"><Table className="cabinet-stockings__table" rowKey="operation_id" size="small" data={[...(page.data?.items ?? [])]} columns={[
{ colKey: 'column1', title: <>时间</>, cell: ({ row: item }) => <>{formatUTC(item.created_at)}</> },
{ colKey: 'column2', title: <>操作</>, cell: ({ row: item }) => <>{kindLabels[item.kind as keyof typeof kindLabels] ?? item.kind}</> },
{ colKey: 'column3', title: <>目标</>, cell: ({ row: item }) => <>{item.target === 'CABINET' ? '整柜' : item.target === 'ALL' ? '全部格口' : `格口 ${item.target}`}</> },
{ colKey: 'column4', title: <>请求状态</>, cell: ({ row: item }) => <><StatusTag value={item.request_status} label={statusLabels[item.request_status as keyof typeof statusLabels] ?? item.request_status} /></> },
{ colKey: 'column5', title: <>观察结果</>, cell: ({ row: item }) => <>{item.kind === 'OPEN_ONE' || item.kind === 'OPEN_ALL' ? '门态见格口状态' : item.observation_status ?? item.connectivity_status ?? '待回读'}</> },
{ colKey: 'column6', title: <>详情</>, cell: ({ row: item }) => <><Button variant="text" onClick={() => setSelected(item)}>查看详情</Button></> }
]} /></div>}
    <Space><Button variant="text" disabled={cursor === '' || page.isFetching} onClick={() => setCursor('')}>最新一页</Button><Button variant="text" disabled={!page.data?.page.has_more || !page.data.page.next_cursor || page.isFetching} onClick={() => setCursor(page.data?.page.next_cursor ?? '')}>下一页</Button></Space>
    <Drawer visible={selected !== null} header={selected === null ? '操作详情' : `${kindLabels[selected.kind as keyof typeof kindLabels] ?? selected.kind}详情`} size="560px" footer={false} onClose={() => setSelected(null)}>
      {selected && <div className="cabinet-side-detail"><section className="cabinet-side-detail__summary"><strong>{selected.operation_id}</strong><StatusTag value={command.data?.execution_status ?? query.data?.status ?? selected.request_status} label={command.data ? cabinetCommandResultLabel(command.data.execution_status) : statusLabels[(query.data?.status ?? selected.request_status) as keyof typeof statusLabels]} /></section>
        {selected.request_status === 'UNKNOWN' && <Alert theme="warning" message="结果待核对。请核对原记录和现场状态，勿直接重复物理命令。" />}
        {(query.isError || command.isError) && <Alert theme="error" message="原操作详情读取失败，请稍后刷新。" />}
        {(query.isLoading || command.isLoading) && <p role="status">正在读取原操作详情…</p>}
        <section><h3>操作事实</h3><dl className="cabinet-side-detail__facts">
          <div><dt>目标</dt><dd>{selected.target}</dd></div><div><dt>创建时间</dt><dd>{formatUTC(selected.created_at)}</dd></div><div><dt>原记录</dt><dd>{selected.detail_ref}</dd></div>
          {query.data && <><div><dt>查询状态</dt><dd>{query.data.status}</dd></div><div><dt>在线结果</dt><dd>{query.data.connectivity_status ?? '无可靠结果'}</dd></div><div><dt>门态结果</dt><dd>{query.data.door_status ?? '无可靠结果'}</dd></div><div><dt>诊断代码</dt><dd>{query.data.result_code ?? '无'}</dd></div><div><dt>观察时间</dt><dd>{query.data.observed_at ? formatUTC(query.data.observed_at) : '尚无可靠观察'}</dd></div></>}
          {command.data && <><div><dt>接口调用结果</dt><dd>{cabinetCommandResultLabel(command.data.execution_status)}</dd></div><div><dt>目标格口</dt><dd>{command.data.targets.map((target) => target.compartment_no).join('、')}</dd></div><div><dt>调用成功时间</dt><dd>{command.data.accepted_at ? formatUTC(command.data.accepted_at) : '—'}</dd></div><div><dt>实际门态</dt><dd>通过独立查询更新，请查看格口状态</dd></div></>}
        </dl></section><p className="cabinet-side-detail__note">此处显示真实千鸣请求与回读记录。系统审计保留操作身份、时间、对象和结果。</p>
      </div>}
    </Drawer>
  </section>;
}
