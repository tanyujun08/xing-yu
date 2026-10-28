import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Button, Input, Select, Space, Table, type PrimaryTableCol } from 'tdesign-react';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';
import type { components, operations } from '../../shared/services/rentalOrders';
import { PageHeader } from '../../shared/ui/PageHeader';
import { AdminListPanel } from '../../shared/ui/AdminListPanel';
import { ListFilterBar, ListFilterField } from '../../shared/ui/ListFilterBar';
import { formatUTC } from '../../shared/format/time';
import { RentalLookup, RentalPager, RentalReadState, rentalMoney } from '../rental-orders/RentalShared';
import { ContractPurchaseDetailDrawer } from './ContractPurchaseDetailDrawer';
import { rentalLabel, rentalLabels } from '../rental-orders/rentalLabels';
import './contract-purchases.css';

type Row = components['schemas']['OpsEntitlementPurchaseListItem'];
export function ContractPurchaseOrdersPage() {
  const session = useSession(); const gateway = useAdminServices().rentalOrders;
  const [params, setParams] = useSearchParams(); const selected = params.get('purchase_id') ?? ''; const cursor = params.get('cursor') ?? '';
  const filter = { buyer_id: params.get('buyer_id') ?? '', kind: params.get('kind') || 'CONTRACT', consideration_status: params.get('consideration_status') ?? '', grant_status: params.get('grant_status') ?? '', cursor, page_size: 20 } as NonNullable<operations['listOpsEntitlementPurchases']['parameters']['query']>;
  const query = useQuery({ queryKey: ['entitlement-purchases', session.accountId, filter], enabled: !!gateway && session.permissions.includes('ops.finance.read'), queryFn: ({ signal }) => gateway!.purchases(filter, signal), retry: false });
  const update = (values: Record<string, string>, reset = true) => setParams((old) => { const next = new URLSearchParams(old); if (reset) next.delete('cursor'); for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); } return next; });
  const columns: PrimaryTableCol<Row>[] = [
    { colKey: 'purchase_no', title: '购买单号', cell: ({ row }) => <Button variant="text" onClick={() => update({ purchase_id: row.purchase_id }, false)}>{row.purchase_no}</Button> },
    { colKey: 'buyer_id', title: '购买用户' }, { colKey: 'kind', title: '服务商品', cell: ({ row }) => rentalLabel(rentalLabels.purchaseKind, row.kind) }, { colKey: 'quantity', title: '份数' },
    { colKey: 'total_cost', title: '实际扣除', cell: ({ row }) => row.cost_unit === 'PINK_POINT' ? `${row.total_cost} 粉钻` : rentalMoney(row.total_cost) },
    { colKey: 'consideration_status', title: '支付状态', cell: ({ row }) => rentalLabel(rentalLabels.purchasePayment, row.consideration_status) }, { colKey: 'grant_status', title: '权益状态', cell: ({ row }) => rentalLabel(rentalLabels.purchaseGrant, row.grant_status) }, { colKey: 'created_at', title: '创建时间', cell: ({ row }) => formatUTC(row.created_at) },
  ];
  return <div className="page-stack"><PageHeader title="购买合同订单" description="合同次数及套餐购买记录；购买成功不代表具体租赁合同已签署。" />
    <AdminListPanel title="服务购买记录" filters={<ListFilterBar ariaLabel="服务购买筛选" actions={<Space><Button onClick={() => void query.refetch()}>刷新</Button><Button onClick={() => setParams({})}>重置</Button></Space>}>
      <ListFilterField label="购买用户"><RentalLookup kind="account" value={filter.buyer_id ?? ''} change={(value) => update({ buyer_id: value })} /></ListFilterField>
      <ListFilterField label="服务类型"><Select value={filter.kind ?? 'CONTRACT'} options={[{ value: 'CONTRACT', label: '合同次数' }, { value: 'PACKAGE', label: '组合套餐' }]} onChange={(value) => update({ kind: String(value) })} /></ListFilterField>
      <ListFilterField label="支付状态"><Select value={filter.consideration_status ?? ''} clearable options={Object.entries(rentalLabels.purchasePayment).map(([value, label]) => ({ value, label }))} onChange={(value) => update({ consideration_status: String(value ?? '') })} /></ListFilterField>
      <ListFilterField label="权益状态"><Select value={filter.grant_status ?? ''} clearable options={Object.entries(rentalLabels.purchaseGrant).map(([value, label]) => ({ value, label }))} onChange={(value) => update({ grant_status: String(value ?? '') })} /></ListFilterField>
      <ListFilterField label="已选用户 ID"><Input value={filter.buyer_id ?? ''} readonly /></ListFilterField>
    </ListFilterBar>} pagination={<RentalPager cursor={cursor} next={query.data?.page.next_cursor} busy={query.isFetching} change={(value) => update({ cursor: value }, false)} />}>
      <RentalReadState pending={query.isLoading} error={query.error} retry={() => void query.refetch()} empty={query.data?.items.length === 0} />{!gateway ? <p>请使用真实 API 环境查看服务购买记录。</p> : null}{!query.isError ? <Table rowKey="purchase_id" columns={columns} data={query.data?.items ?? []} /> : null}
    </AdminListPanel><ContractPurchaseDetailDrawer key={`${session.accountId}:${selected}`} id={selected} onClose={() => update({ purchase_id: '' }, false)} />
  </div>;
}
