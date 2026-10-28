import { AdminLink as Link } from '../../shared/ui/AdminLink';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Button, Input, Select, Space, type InputRef } from 'tdesign-react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';
import { formatFenExact } from '../../shared/format/money';
import type { components } from '../../shared/services/rentalOrders';

export const rentalMoney = (value: string | null | undefined) => value === null || value === undefined ? '待确认' : formatFenExact(value);
export function useRentalVisible() { const [visible, setVisible] = useState(!document.hidden); useEffect(() => { const update = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update); }, []); return visible; }
export function RentalReadState({ pending, error, retry, empty }: { pending: boolean; error: unknown; retry: () => void; empty?: boolean }) { return pending ? <p role="status">正在读取…</p> : error ? <Alert theme="error" message={error instanceof Error ? error.message : '读取失败'} operation={<Button tag="button" type="button" onClick={retry}>重新读取</Button>} /> : empty ? <p>暂无符合条件的记录</p> : null; }
export function RentalPager({ cursor, next, busy, change }: { cursor: string; next?: string | null | undefined; busy: boolean; change: (cursor: string) => void }) { return <Space><Button tag="button" type="button" disabled={busy || !cursor} onClick={() => change('')}>第一页</Button><Button tag="button" type="button" disabled={busy || !next} onClick={() => change(next!)}>下一页</Button></Space>; }
export function RentalFacts({ entries }: { entries: [string, ReactNode][] }) { return <dl className="detail-definition-list detail-definition-list--2">{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>; }
export function RentalBlockers({ items }: { items: components['schemas']['Blocker'][] }) { return items.length ? <Alert theme="warning" message={<ul>{items.map((item, index) => <li key={index}>{item.message}</li>)}</ul>} /> : null; }
export function RentalMedia({ items }: { items: components['schemas']['OrderMediaView'][] }) { return <Space breakLine>{items.map((item) => item.availability !== 'READY' || !item.media ? <p key={item.material_id}>材料 {item.material_id} 暂不可用</p> : item.kind === 'VIDEO' ? <video key={item.material_id} controls preload="metadata" src={item.media.url} poster={item.media.poster?.url} style={{ maxWidth: 320, maxHeight: 240 }} /> : <Link key={item.material_id} href={item.media.url} target="_blank" rel="noreferrer"><img src={item.media.url} alt="订单凭证" style={{ maxWidth: 160, maxHeight: 140 }} /></Link>)}</Space>; }
type RentalLookupKind = 'account' | 'asset' | 'merchant';
type RentalLookupProps = { kind: RentalLookupKind; value: string; change: (value: string) => void };
export function RentalLookup(props: RentalLookupProps) {
  const session = useSession();
  const permission = props.kind === 'account' ? 'ops.members.read' : props.kind === 'asset' ? 'ops.assets.read' : 'ops.merchants.read';
  const allowed = session.permissions.includes(permission);
  // Discard local search and popup state when the reader or permission changes.
  return <RentalLookupControl key={`${session.accountId}:${props.kind}:${allowed}`} {...props} allowed={allowed} />;
}
function RentalLookupControl({ kind, value, change, allowed }: RentalLookupProps & { allowed: boolean }) {
  const session = useSession(); const gateway = useAdminServices().rentalOrders;
  const [text, setText] = useState(''); const [query, setQuery] = useState(''); const [cursor, setCursor] = useState('');
  const input = useRef<InputRef>(null); const selection = useRef<HTMLDivElement>(null);
  const label = { account: '参与用户', asset: '资产', merchant: '商家' }[kind];
  const canQuery = allowed && !!gateway;
  const result = useQuery({ queryKey: ['rental-lookup', session.accountId, kind, query, cursor], enabled: canQuery, retry: false, staleTime: 0, refetchOnMount: 'always', queryFn: async ({ signal }) => {
    if (kind === 'account') { const r = await gateway!.members(query, cursor, signal); return { options: r.items.map((v) => ({ label: `${v.display_name} · ${v.account_id}`, value: v.account_id })), page: r.page }; }
    if (kind === 'asset') { const r = await gateway!.assets(query, cursor, signal); return { options: r.items.map((v) => ({ label: `${v.display_name} · ${v.asset_id}`, value: v.asset_id })), page: r.page }; }
    const r = await gateway!.merchants(query, cursor, signal); return { options: r.items.map((v) => ({ label: `${v.name} · ${v.merchant_id}`, value: v.merchant_id })), page: r.page };
  } });
  // Input aria props target TDesign's wrapper. Name its actual input instead.
  useEffect(() => {
    input.current?.inputElement.setAttribute('aria-label', `搜索${label}`);
    selection.current?.querySelector('input')?.setAttribute('aria-label', `选择${label}`);
  }, [label]);
  const search = () => {
    if (!canQuery || result.isFetching) return;
    const next = text.trim();
    if (next === query && cursor === '') { void result.refetch(); return; }
    setQuery(next); setCursor('');
  };
  // A loading, failed or unauthorized read cannot offer cached candidates.
  // Keep only the original selected ID until a current authorized read succeeds.
  const data = canQuery && result.isSuccess && !result.isFetching ? result.data : undefined;
  const options = data?.options ?? [];
  const selectedOptions = value && !options.some((option) => option.value === value) ? [{ value, label: value }, ...options] : options;
  return <Space direction="vertical">
    <Space><Input ref={input} value={text} placeholder="搜索后选择授权记录" onChange={setText} disabled={!canQuery} onEnter={(_value, { e }) => { if (e.nativeEvent.isComposing) return; e.preventDefault(); search(); }} /><Button tag="button" type="button" aria-label={`搜索${label}`} disabled={!canQuery || result.isFetching} onClick={search}>搜索</Button></Space>
    <div ref={selection}><Select value={value} clearable disabled={!canQuery || result.isFetching} placeholder={allowed ? '选择记录' : '无查询权限'} options={selectedOptions} onChange={(next) => { if (canQuery && !result.isFetching) change(String(next ?? '')); }} /></div>
    {!allowed ? <p>当前账号没有{label}查询权限。</p> : !gateway ? <p>当前环境未提供{label}查询能力。</p> : result.isFetching ? <p role="status">正在读取{label}选项…</p> : result.isError ? <Alert theme="error" message={`${label}选项读取失败，请重试。`} operation={<Button tag="button" type="button" onClick={() => void result.refetch()}>重新读取{label}</Button>} /> : data?.options.length === 0 ? <p role="status">暂无符合条件的{label}，请调整搜索条件。</p> : null}
    <RentalPager cursor={cursor} next={data?.page.next_cursor} busy={!canQuery || result.isFetching || result.isError} change={setCursor} />
  </Space>;
}
