import { AdminRouteLink as Link } from '../../shared/ui/AdminRouteLink';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Drawer } from 'tdesign-react';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';
import { formatUTC } from '../../shared/format/time';
import { RentalFacts, RentalPager, RentalReadState, rentalMoney } from '../rental-orders/RentalShared';
import { rentalLabel, rentalLabels } from '../rental-orders/rentalLabels';

export function ContractPurchaseDetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const session = useSession(); const gateway = useAdminServices().rentalOrders; const [cursor, setCursor] = useState('');
  const detail = useQuery({ queryKey: ['entitlement-purchase', session.accountId, id], enabled: !!id && !!gateway, queryFn: ({ signal }) => gateway!.purchase(id, signal), retry: false });
  const d = detail.data;
  const movements = useQuery({ queryKey: ['entitlement-movements', session.accountId, d?.buyer_id, id, cursor], enabled: !!d && session.permissions.includes('ops.members.read'), queryFn: ({ signal }) => gateway!.movements(d!.buyer_id, id, cursor, signal), retry: false });
  const lots = d?.items?.map((item) => item.lot) ?? (d?.lot ? [d.lot] : []);
  return <Drawer visible={!!id} header={d ? `购买订单详情 · ${d.purchase_no}` : '购买订单详情'} size="760px" footer={false} onClose={onClose}>
    <div className="contract-purchase-detail"><Button onClick={() => void detail.refetch()}>查询原购买结果</Button><RentalReadState pending={detail.isLoading} error={detail.error} retry={() => void detail.refetch()} />
      {d && !detail.isError ? <><section><h3>购买主体与价格快照</h3><p className="contract-purchase-detail-note">这是服务次数购买记录。粉钻兑换与微信现金付款分开显示；租赁协议同意记录须进入具体租赁订单查询。</p><RentalFacts entries={[
        ['购买编号', d.purchase_no], ['购买用户', d.buyer_id], ['商品', d.name ?? d.offer_code ?? rentalLabel(rentalLabels.purchaseKind, d.kind)], ['数量', d.quantity], ['扣除单位', d.cost_unit === 'PINK_POINT' ? '粉钻' : '人民币'], ['实付', d.cost_unit === 'PINK_POINT' ? `${d.total_cost} 粉钻` : rentalMoney(d.total_cost)], ['支付状态', rentalLabel(rentalLabels.purchasePayment, d.consideration_status)], ['权益状态', rentalLabel(rentalLabels.purchaseGrant, d.grant_status)], ['规则版本', d.rule_version_id], ['创建时间', formatUTC(d.created_at)], ['权益发放时间', d.granted_at ? formatUTC(d.granted_at) : '未发放'],
      ]} /></section><section><h3>合同服务权益</h3>{lots.map((lot) => <RentalFacts key={lot.lot_id} entries={[
        ['权益批次', lot.lot_id], ['已发放', lot.granted_quantity], ['可用', lot.available_quantity], ['预占', lot.reserved_quantity], ['已消费', lot.consumed_quantity], ['过期', lot.expired_quantity], ['撤回', lot.revoked_quantity], ['有效期', lot.valid_until ? formatUTC(lot.valid_until) : '长期'],
      ]} />)}</section><section><h3>权益流水</h3>{session.permissions.includes('ops.members.read') ? <><RentalReadState pending={movements.isLoading} error={movements.error} retry={() => void movements.refetch()} empty={movements.data?.items.length === 0} /><ol className="contract-purchase-ledger">{!movements.isError ? movements.data?.items.map((movement) => <li key={movement.movement_id}><div><strong>{rentalLabel(rentalLabels.entitlementAction, movement.action)} · {movement.quantity} 次</strong><small>{formatUTC(movement.occurred_at)} · {movement.movement_id}</small><small>可用 {movement.available_before_qty} → {movement.available_after_qty}；原流水 {movement.reversal_of ?? '—'}；权益批次 {movement.lot_id}</small></div></li>) : null}</ol><RentalPager cursor={cursor} next={movements.data?.page.next_cursor} busy={movements.isFetching} change={setCursor} /></> : <p>没有权益流水查询权限。</p>}</section>
      {session.permissions.includes('ops.orders.read') ? <Link to={`/orders/rental?account_id=${encodeURIComponent(d.buyer_id)}`}>查看该用户参与的租赁订单，选择订单后查看协议同意记录</Link> : null}
    </> : null}</div>
  </Drawer>;
}
