import { useRef, useState } from 'react';
import { Link, Alert, Button, Space } from 'tdesign-react';
import type { LoyaltySaveIntent } from './loyaltySaveIntent';

interface OriginalRequestSummary {
  baselineEpoch: string;
  reason: string;
  fields: readonly { label: string; value: string }[];
}

interface Props<TBody> {
  intent: LoyaltySaveIntent<TBody>;
  describeOriginal: (body: TBody) => OriginalRequestSummary;
  draftDifferent: boolean;
  onRetry: (intent: LoyaltySaveIntent<TBody>) => Promise<void>;
  auditHref: string;
  pending?: boolean;
}

export function LoyaltySaveRecovery<TBody>({ intent, describeOriginal, draftDifferent, onRetry, auditHref, pending = false }: Props<TBody>) {
  const summary = describeOriginal(intent.body);
  const lock = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = pending || retrying;
  const retry = async () => {
    if (busy || lock.current) return;
    lock.current = true; setRetrying(true); setError(null);
    try { await onRetry(structuredClone(intent)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '原保存结果仍未确认，请查询操作记录。'); }
    finally { lock.current = false; setRetrying(false); }
  };
  return <section className="loyalty-save-review" aria-label="恢复原保存请求">
    <Alert theme="warning" message="原保存结果尚未确认。请先核对以下原请求内容并恢复原保存。" />
    {draftDifferent ? <p role="status">当前草稿与原请求不同，草稿已保留；原请求结果确认前不能保存这份草稿。</p> : null}
    <p>原请求基线生效序号：<span className="mono-value">{summary.baselineEpoch}</span></p>
    <dl className="loyalty-original-fields">{summary.fields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
    <p>原保存原因：{summary.reason}</p>
    <Space><Button tag="button" theme="primary" disabled={busy} loading={busy} onClick={() => void retry()}>恢复原保存</Button><Link href={auditHref}>查询原操作记录</Link></Space>
    {error === null ? null : <Alert theme="error" message={error} />}
  </section>;
}
