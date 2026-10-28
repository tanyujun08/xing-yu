import { AdminRouteLink as Link } from '../../shared/ui/AdminRouteLink';
import { AdminDisclosure } from '../../shared/ui/AdminDisclosure';
import { rentalExceptionLabel, rentalLabel, rentalLabels } from './rentalLabels';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Space, Link as ExternalLink } from 'tdesign-react';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';
import { formatUTC } from '../../shared/format/time';
import { DetailSurface } from '../../shared/ui/DetailSurface';
import { RentalBlockers, RentalFacts, RentalMedia, RentalReadState, rentalMoney, useRentalVisible } from './RentalShared';
import { RentalFundingHistory } from './RentalFundingHistory';
import { RentalReviewPanel } from './RentalReviewPanel';
import { RentalUnpickedRefund } from './RentalUnpickedRefund';

export function RentalOrderDetail({ id }: { id: string }) {
  const session = useSession(); const gateway = useAdminServices().rentalOrders; const visible = useRentalVisible();
  const canRead = session.permissions.includes('ops.orders.read');
  const [contractOpen, setContractOpen] = useState(false); const [taskOpen, setTaskOpen] = useState(false);
  const detail = useQuery({ queryKey: ['rental-detail', session.accountId, id], enabled: !!gateway && visible && canRead, queryFn: ({ signal }) => gateway!.detail(id, signal), retry: false, refetchInterval: visible && canRead ? 15000 : false, refetchIntervalInBackground: false, refetchOnWindowFocus: 'always' });
  const contract = useQuery({ queryKey: ['rental-contract', session.accountId, id], enabled: !!gateway && contractOpen && visible && canRead, queryFn: ({ signal }) => gateway!.contract(id, signal), retry: false });
  const tasks = useQuery({ queryKey: ['rental-tasks', session.accountId, id], enabled: !!gateway && taskOpen && visible && canRead, queryFn: ({ signal }) => gateway!.tasks(id, signal), retry: false, refetchInterval: visible && taskOpen && canRead ? 5000 : false, refetchIntervalInBackground: false });
  const data = canRead ? detail.data?.data : undefined;
  const isTestPayment = data?.order.payment_mode === 'FIXED_10_FEN';
  const supplement = data?.bill.supplement?.paid_payment ?? data?.bill.supplement?.active_payment;
  const refund = data?.bill.refund_summary.latest_refund;
  const refundStatus = refund ? rentalLabel(rentalLabels.refund, refund.status) : '暂无退款记录';
  const couponStatus = data?.coupon_status ? ({ RESERVED: '已预占', CONSUMED: '已使用', RELEASED: '已释放', RESTORED: '已恢复' } as const)[data.coupon_status] : '未使用优惠券';
  const supplementStatus = supplement ? rentalLabel(rentalLabels.payment, supplement.status) : (data?.bill.finalized ? data.bill.supplement_due_fen === null ? '待确认' : BigInt(data.bill.supplement_due_fen) > 0n ? '尚未发起' : '无需补缴' : '待最终核定');
  const supplementLink = data && supplement && session.permissions.includes('ops.finance.read')
    ? `/finance?${new URLSearchParams({ tab: 'payments', order_no: data.order.order_no, purpose: 'SUPPLEMENT', payment_id: supplement.payment_id })}`
    : null;
  if (!canRead) return <Alert theme="warning" message="当前账号没有订单读取权限" />;
  return <div className="page-stack"><Space><Button onClick={() => void detail.refetch()}>刷新订单</Button>{data ? <Button onClick={() => void navigator.clipboard.writeText(data.order.order_no)}>复制订单号</Button> : null}</Space>
    <RentalReadState pending={detail.isLoading} error={detail.error} retry={() => void detail.refetch()} />
    {data && !detail.isError ? <>
      <RentalUnpickedRefund key={'refund:' + session.accountId + id} order={detail.data!} fresh={!detail.isFetching && visible} refresh={() => detail.refetch()} />
      <DetailSurface title={`${data.order.order_no} · ${data.order.display_status}`}><RentalFacts entries={[
        ['资产', <Link to={`/assets/${data.order.asset.asset_id}`}>{data.order.asset.title}</Link>], ['商家', data.merchant_id ? <Link to={`/merchants/${data.merchant_id}`}>{data.order.participants.merchant_name ?? data.merchant_id}</Link> : data.order.supply_channel === 'PERSONAL' ? '个人出租' : '平台供给'],
        ['承租人', data.order.participants.tenant_display_name ?? data.order.participants.tenant_account_id], ['出租方', data.order.participants.lessor_display_name ?? data.order.participants.lessor_id],
        ['租赁开始', formatUTC(data.order.rental_start_at)], ['租赁结束', formatUTC(data.order.rental_end_at)], ['实物状态', rentalLabel(rentalLabels.physical, data.order.physical_status)], ['审核状态', rentalLabel(rentalLabels.review, data.order.review_status)], ['完成时间', data.completed_at ? formatUTC(data.completed_at) : '—'], ['关闭时间', data.closed_at ? formatUTC(data.closed_at) : '—'],
      ]} /><RentalBlockers items={data.order.blockers} />{data.order.has_exception ? <Alert theme="warning" message={`订单异常：${data.order.exception_codes.map((code) => rentalExceptionLabel(code, data.order.blockers)).join('、')}。无法处理的情况由官方人员在线下酌情处理。`} /> : null}</DetailSurface>
      <DetailSurface title="成交快照与费用">{isTestPayment ? <Alert theme="warning" message="测试支付：每笔渠道下单 0.10 元。业务价格与押金覆盖用于流程测试，不代表实际收款；真实资金见累计收款与退款，测试订单不生成收益。" /> : null}<RentalFacts entries={[
        ['租金原价', rentalMoney(data.fees.rent_gross_fen)], ['租金优惠', rentalMoney(data.fees.rent_discount_fen)], ['原押金 / 免押', `${rentalMoney(data.fees.deposit_list_fen)} / ${rentalMoney(data.fees.deposit_waived_fen)}`], ['初始应付', rentalMoney(data.fees.initial_due_fen)], [isTestPayment ? '渠道订单实收' : '订单结清金额', rentalMoney(data.order.initial_paid_fen)], ['微信实付', rentalMoney(data.order.initial_payer_total_fen)], [isTestPayment ? '测试业务押金覆盖' : '已收押金', rentalMoney(data.bill.deposit_received_fen)], ['已核超期费', rentalMoney(data.bill.overtime_fen)], ['已核损失', rentalMoney(data.bill.loss_fen)], [isTestPayment ? '测试业务押金抵扣' : '已扣抵押金', rentalMoney(data.bill.deducted_fen)], [isTestPayment ? '业务应退押金' : '应退押金', rentalMoney(data.bill.refund_due_fen)], ['应补缴', rentalMoney(data.bill.supplement_due_fen)],
        ['优惠券状态', couponStatus], ['补缴状态', supplementStatus], ['补缴记录', supplement ? supplementLink ? <Link to={supplementLink}>查看原补缴记录 {supplement.payment_id}</Link> : supplement.payment_id : '—'],
        ['补缴支付截止', supplement ? formatUTC(supplement.expires_at) : '—'], ['补缴成功时间', supplement?.paid_at ? formatUTC(supplement.paid_at) : '—'], ['补缴最近核验', supplement ? supplement.last_verified_at ? formatUTC(supplement.last_verified_at) : '尚未核验' : '—'],
        ['累计收款', rentalMoney(data.bill.funds_summary.gross_received_fen)], ['累计退款', rentalMoney(data.bill.funds_summary.refunded_fen)], ['用户净实付', rentalMoney(data.bill.funds_summary.payer_net_fen)], ['待退责任', rentalMoney(data.bill.refund_summary.pending_fen)], ['已退押金', rentalMoney(data.bill.deposit_refunded_fen)], ['原退款状态', refundStatus], ['收益记录', data.earning_id ? <Link to={`/finance?earning_id=${data.earning_id}`}>{data.earning_id}</Link> : isTestPayment ? '测试订单不生成收益' : '尚未入账'],
      ]} />{refund ? <><RentalFacts entries={[
        ['原退款编号', refund.refund_id], ...(isTestPayment ? [['退款业务覆盖', rentalMoney(refund.business_amount_fen)] as [string, string]] : []), ['退款结算金额', rentalMoney(refund.amount_fen)], ['微信实际退款', rentalMoney(refund.payer_refund_fen)], ['退款成功时间', refund.refunded_at ? formatUTC(refund.refunded_at) : '—'], ['退款最近核验', refund.last_verified_at ? formatUTC(refund.last_verified_at) : '尚未核验'],
      ]} /><RentalBlockers items={refund.blockers} />{refund.allowed_actions.filter((action) => !!action.display_reason).map((action) => <p key={action.action_code}>{action.display_reason}</p>)}</> : null}<AdminDisclosure  title={<>查看成交资产与规则快照</>}><p>{data.asset_snapshot.description}</p><p>{data.asset_snapshot.condition_description}</p><p>设备标识：{data.asset_snapshot.physical_identifier_display ?? '—'}</p><ul>{data.asset_snapshot.accessories.map((a) => <li key={a.item_code}>{a.name} × {a.quantity}</li>)}</ul><RentalMedia items={data.asset_snapshot.media} /><p>归还说明：{data.requirements.return_instructions}</p><p>取件说明：{data.requirements.pickup_instructions || '无补充说明'}</p><p>订单策略版本：{data.requirements.policy_version_id}</p></AdminDisclosure></DetailSurface>
      <DetailSurface title="交付与合同"><RentalFacts entries={[
        ['交付方式', data.delivery.method === 'CABINET' ? '租赁柜取还' : '快递往返'], ['快递公司 / 单号', data.delivery.method === 'EXPRESS' ? `${data.delivery.carrier ?? '—'} / ${data.delivery.tracking_no ?? '—'}` : '不适用'], ['发货时间', data.delivery.shipped_at ? formatUTC(data.delivery.shipped_at) : '—'], ['交付时间', data.delivery.delivered_at ? formatUTC(data.delivery.delivered_at) : '未确认交付'],
      ]} /><Space><Button onClick={() => setContractOpen(!contractOpen)}>查看合同与次数</Button><Button onClick={() => setTaskOpen(!taskOpen)}>查看原取还任务</Button></Space>
        {contractOpen ? <><RentalReadState pending={contract.isLoading} error={contract.error} retry={() => void contract.refetch()} />{contract.data && !contract.isError ? <><RentalFacts entries={[
          ['合同编号', contract.data.contract_id], ['签署状态', contract.data.status === 'SUCCEEDED' ? '已签署' : contract.data.status === 'EXPIRED' ? '已过期' : '待签署'], ['合同次数状态', rentalLabel(rentalLabels.quota, contract.data.quota_state)], ['合同次数原有效期', contract.data.quota_valid_until ? formatUTC(contract.data.quota_valid_until) : '不适用或长期有效'], ['模板版本', contract.data.template_version_id], ['协议摘要', contract.data.agreement_sha256], ['订单条款摘要', contract.data.order_terms_sha256], ['签署截止', formatUTC(contract.data.expires_at)],
        ]} /><p style={{ whiteSpace: 'pre-wrap' }}>{contract.data.agreement_text}</p><RentalFacts entries={[
          ['出租方签署', `${contract.data.lessor_signature.name} · 默认已签署`],
          ['承租人签署', `${contract.data.tenant_signature.name} · ${contract.data.tenant_signature.status === 'SUCCEEDED' ? '已签署' : '待签署'}`],
          ['承租人签署时间', contract.data.tenant_signature.signed_at ? formatUTC(contract.data.tenant_signature.signed_at) : '尚未签署'],
        ]} />{contract.data.status === 'SUCCEEDED' && contract.data.final_artifact ? <RentalFacts entries={[
          ['已签署合同', <ExternalLink href={contract.data.final_artifact.document_url} target="_blank">查看已签署合同 PDF</ExternalLink>],
          ['成品摘要', contract.data.final_artifact.document_sha256], ['合同页数', String(contract.data.final_artifact.page_count)],
        ]} /> : null}<RentalBlockers items={contract.data.blockers} /></> : null}</> : null}
        {taskOpen ? <><RentalReadState pending={tasks.isLoading} error={tasks.error} retry={() => void tasks.refetch()} empty={tasks.data?.items.length === 0} />{!tasks.isError ? tasks.data?.items.map((t) => <section key={t.task_id}><h3>{t.purpose === 'PICKUP' ? '取件' : '归还'}任务 {t.task_id}</h3><RentalFacts entries={[
          ['执行状态', rentalLabel(rentalLabels.cabinetStatus, t.status)], ['柜机 / 格口', <Link to={`/cabinets?cabinet_id=${t.cabinet_id}`}>{t.cabinet_id} / {t.compartment_id}</Link>], ['门态', rentalLabel(rentalLabels.door, t.door_status)], ['RFID / 占用', `${rentalLabel(rentalLabels.rfid, t.rfid_result)} / ${rentalLabel(rentalLabels.occupancy, t.occupancy_result)}`], ['观察时间', t.observed_at ? formatUTC(t.observed_at) : '未观察'], ['确认时间', t.confirmed_at ? formatUTC(t.confirmed_at) : '未确认'],
        ]} /><RentalBlockers items={t.blockers} /></section>) : null}</> : null}
      </DetailSurface>
      <RentalFundingHistory key={'history:' + session.accountId + id} id={id} /><RentalReviewPanel order={detail.data!} refresh={() => detail.refetch()} />
      {session.permissions.includes('ops.finance.read') ? <Link to={`/finance?order_no=${encodeURIComponent(data.order.order_no)}&tab=payments`}>查看原支付、退款及核查结果</Link> : null}
    </> : null}
  </div>;
}
