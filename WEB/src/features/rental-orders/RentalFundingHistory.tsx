import { randomId } from '../../shared/randomId';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Input, Space } from 'tdesign-react';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';
import { DetailSurface } from '../../shared/ui/DetailSurface';
import { RentalFacts, RentalReadState, rentalMoney, useRentalVisible } from './RentalShared';
import { rentalLabel, rentalLabels } from './rentalLabels';
import { formatUTC } from '../../shared/format/time';
import { rentalFailure, rentalRefundVerificationRejected } from '../../shared/services/rentalOrders';

export function RentalFundingHistory({ id }: { id: string }) {
  const session = useSession(), gateway = useAdminServices().rentalOrders, visible = useRentalVisible();
  const [open, setOpen] = useState(false), [kind, setKind] = useState<'payment' | 'refund'>('payment');
  const [cursor, setCursor] = useState<string>(), [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const [paymentId, setPaymentId] = useState(''), [refundNo, setRefundNo] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const intent = useRef<{ paymentId: string; refundNo: string; key: string } | null>(null);
  const [intentLocked, setIntentLocked] = useState(false);
  const canRead = session.permissions.includes('ops.orders.read');
  const payments = useQuery({ queryKey: ['order-payment-history', session.accountId, id, cursor], enabled: !!gateway && canRead && visible && open && kind === 'payment', queryFn: ({ signal }) => gateway!.paymentHistory(id, cursor, signal), retry: false });
  const refunds = useQuery({ queryKey: ['order-refund-history', session.accountId, id, cursor], enabled: !!gateway && canRead && visible && open && kind === 'refund', queryFn: ({ signal }) => gateway!.refundHistory(id, cursor, signal), retry: false });
  const page = kind === 'payment' ? payments : refunds;
  async function verify() {
    if (!gateway || busy || !visible || !session.permissions.includes('ops.refunds.recover') || !paymentId || !/^[A-Za-z0-9_-]{1,64}$/.test(refundNo)) return;
    intent.current ??= { paymentId, refundNo, key: randomId() };
    const original = intent.current;
    setIntentLocked(true);
    setBusy(true);
    try {
      await gateway.verifyExternalRefund(original.paymentId, original.refundNo, original.key);
      intent.current = null; setIntentLocked(false); setNotice('核验任务已提交，请刷新退款历史查看结果。');
    } catch (error) {
      if (rentalRefundVerificationRejected(error)) {
        intent.current = null;
        setIntentLocked(false);
        setNotice(rentalFailure(error));
      } else { setNotice('提交结果待核实；保留原内容，再次核验将使用同一请求。'); }
    }
    finally { setBusy(false); }
  }
  if (!canRead) return null;
  return <DetailSurface title="支付与退款历史">
    <Space><Button onClick={() => setOpen(!open)}>{open ? '收起历史' : '查看历史'}</Button>{open ? <><Button onClick={() => { setKind('payment'); setCursor(undefined); setPrevious([]); }}>支付</Button><Button onClick={() => { setKind('refund'); setCursor(undefined); setPrevious([]); }}>退款</Button><Button onClick={() => void page.refetch()}>刷新</Button></> : null}</Space>
    {open ? <>
      <RentalReadState pending={page.isLoading} error={page.error} retry={() => void page.refetch()} empty={page.data?.items.length === 0} />
      {!page.isError && kind === 'payment' ? payments.data?.items.map(p => <section key={p.payment_id}><RentalFacts entries={[
        ['用途', p.purpose === 'INITIAL' ? '首付' : `补缴 · 第${p.generation}次`], ['状态', rentalLabel(rentalLabels.payment, p.status)], ['支付模式', p.payment_mode === 'FIXED_10_FEN' ? '测试支付' : '正常支付'], ['业务金额', rentalMoney(p.business_amount_fen)], ['渠道金额', rentalMoney(p.channel_amount_fen)], ['微信实付', rentalMoney(p.payer_total_fen)], ['商户支付单号', p.out_trade_no], ['创建时间', formatUTC(p.created_at)], ['截止时间', formatUTC(p.expires_at)],
      ]} />{p.status === 'SUCCEEDED' && session.permissions.includes('ops.refunds.recover') ? <Button disabled={busy || intentLocked} onClick={() => { setPaymentId(p.payment_id); setRefundNo(''); setNotice(''); }}>核验此支付的商户平台退款</Button> : null}</section>) : null}
      {!page.isError && kind === 'refund' ? refunds.data?.items.map(r => <section key={r.refund_id}><RentalFacts entries={[
        ['用途', r.purpose === 'DEPOSIT' ? '退押金' : r.purpose === 'EXCESS_PAYMENT' ? '重复收款退款' : '未履约退款'], ['状态', rentalLabel(rentalLabels.refund, r.status)], ['支付模式', r.payment_mode === 'FIXED_10_FEN' ? '测试支付' : '正常支付'], ['业务退款覆盖', rentalMoney(r.business_amount_fen)], ['退款金额', rentalMoney(r.amount_fen)], ['微信实退', rentalMoney(r.payer_refund_fen)], ['商户退款单号', r.out_refund_no], ['原支付', r.original_payment_id],
      ]} /></section>) : null}
      <Space><Button disabled={!previous.length} onClick={() => { setCursor(previous.at(-1)); setPrevious(previous.slice(0, -1)); }}>上一页</Button><Button disabled={!page.data?.has_more || !page.data.next_cursor || page.isFetching} onClick={() => { setPrevious([...previous, cursor]); setCursor(page.data!.next_cursor!); }}>下一页</Button></Space>
      {paymentId && session.permissions.includes('ops.refunds.recover') ? <><p>输入商户平台的原退款单号，查询核实退款结果。</p><Input aria-label="商户退款单号" value={refundNo} maxlength={64} disabled={busy || intentLocked} onChange={setRefundNo} /><Button loading={busy} disabled={!refundNo} onClick={() => void verify()}>查询核验</Button>{notice ? <Alert theme="info" message={notice} /> : null}</> : null}
    </> : null}
  </DetailSurface>;
}
