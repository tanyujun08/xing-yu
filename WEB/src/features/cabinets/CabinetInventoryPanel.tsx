import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Table, Alert, Button } from 'tdesign-react';
import type { CabinetManagementGateway } from '../../shared/services/cabinetManagement';

export function CabinetInventoryPanel({ cabinetId, gateway, accountId, visible }: {
  cabinetId: string; gateway: CabinetManagementGateway; accountId: string | null; visible: boolean;
}) {
  const navigate = useNavigate();
  const slots = useQuery({
    queryKey: ['cabinet-management', accountId, 'slots', cabinetId],
    queryFn: ({ signal }) => gateway.compartments(cabinetId, { signal }),
    enabled: visible, retry: false, refetchOnWindowFocus: 'always',
  });
  const occupied = (slots.data?.items ?? []).filter((slot) => slot.occupant !== null);
  return <section className="cabinet-stockings" aria-label="在柜资产">
    <div className="cabinet-section-heading"><div><h3>在柜资产</h3><p>显示已登记的实际在柜资产。入柜与上架分开，请在资产管理中上架或下架。</p></div><Button variant="outline" disabled={slots.isFetching} onClick={() => void slots.refetch()}>刷新资产</Button></div>
    {slots.isLoading && <p role="status">正在读取在柜资产…</p>}
    {slots.isError && <Alert theme="error" message="在柜资产读取失败，请刷新后核对。" />}
    {!slots.isLoading && !slots.isError && occupied.length === 0 && <p className="cabinet-empty">暂无在柜资产</p>}
    {occupied.length > 0 && <div className="cabinet-stockings__table-wrap"><Table ref={(table) => table?.tableHtmlElement?.setAttribute('aria-label', '在柜资产')} className="cabinet-stockings__table" rowKey="compartment_id" size="small" data={[...(occupied ?? [])]} columns={[
{ colKey: 'column1', title: <>格口</>, cell: ({ row: slot }) => <>BOX {String(slot.compartment_no).padStart(2, '0')}</> },
{ colKey: 'column2', title: <>资产</>, cell: ({ row: slot }) => <><strong>{slot.occupant!.display_name}</strong></> },
{ colKey: 'column3', title: <>资产编号</>, cell: ({ row: slot }) => <>{slot.occupant!.asset_no}</> },
{ colKey: 'column4', title: <>操作</>, cell: ({ row: slot }) => <><Button variant="text" onClick={() => navigate('/assets/' + encodeURIComponent(slot.occupant!.asset_id))}>查看资产</Button></> }
]} /></div>}
  </section>;
}
