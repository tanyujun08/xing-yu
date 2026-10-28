import { useRef, useState } from 'react';
import { Table, Alert, Button, Dialog, Space, Textarea } from 'tdesign-react';
import { parseLoyaltyReason } from './loyaltyInputs';
import './loyalty-management.css';

export interface LoyaltyFieldDifference {
  field: string;
  label: string;
  before: string;
  after: string;
}

interface Props {
  visible: boolean;
  version: string | null;
  epoch: string;
  differences: readonly LoyaltyFieldDifference[];
  impacts: readonly string[];
  reason: string;
  onReasonChange: (reason: string) => void;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
  pending?: boolean;
  error?: string | null;
}

export function LoyaltySaveReview({ visible, version, epoch, differences, impacts, reason, onReasonChange, onCancel, onConfirm, pending = false, error = null }: Props) {
  const lock = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const parsed = parseLoyaltyReason(reason);
  const busy = pending || submitting;
  const submit = async () => {
    if (busy || lock.current || !parsed.ok) return;
    lock.current = true;
    setSubmitting(true);
    setFailure(null);
    try { await onConfirm(parsed.value); }
    catch (cause) { setFailure(cause instanceof Error ? cause.message : '保存结果尚未确认，请查询原操作记录。'); }
    finally { lock.current = false; setSubmitting(false); }
  };
  return <Dialog visible={visible} header="确认保存并生效" width={760} closeOnOverlayClick={false}
    closeOnEscKeydown={!busy} closeBtn={!busy} onClose={() => { if (!busy) onCancel(); }}
    footer={<Space><Button tag="button" variant="outline" disabled={busy} onClick={onCancel}>返回编辑</Button><Button tag="button" theme="primary" loading={busy} disabled={busy || !parsed.ok} onClick={() => void submit()}>确认保存并生效</Button></Space>}>
    <div className="loyalty-save-review">
      <p>当前配置版本：<span className="mono-value">{version ?? '尚未配置'}</span> · 生效序号：<span className="mono-value">{epoch}</span></p>
      <section aria-label="本次配置变更"><h4>本次配置变更</h4><Table ref={(table) => table?.tableHtmlElement?.setAttribute('aria-label', '本次配置变更')} className="loyalty-difference-table" rowKey="field" size="small" data={[...(differences ?? [])]} columns={[
{ colKey: 'column1', title: <>字段</>, cell: ({ row: item }) => <>{item.label}</> },
{ colKey: 'column2', title: <>当前值</>, cell: ({ row: item }) => <>{item.before}</> },
{ colKey: 'column3', title: <>拟生效值</>, cell: ({ row: item }) => <>{item.after}</> }
]} /></section>
      {differences.length === 0 ? <p>本次字段值未变化。</p> : null}
      {impacts.length > 0 ? <section aria-label="配置影响"><h3>配置影响</h3><ul>{impacts.map((impact) => <li key={impact}>{impact}</li>)}</ul></section> : null}
      <label className="loyalty-reason-field">保存原因<Textarea value={reason} onChange={onReasonChange} disabled={busy} placeholder="填写本次调整原因（3～256 个字符）" /></label>
      {!parsed.ok && reason !== '' ? <p role="alert">{parsed.message}</p> : null}
      {error ?? failure ? <Alert theme="error" message={error ?? failure} /> : null}
      <p>保存后以服务端回读的最新生效配置为准；已领取优惠券保留领取时的权益。</p>
    </div>
  </Dialog>;
}
