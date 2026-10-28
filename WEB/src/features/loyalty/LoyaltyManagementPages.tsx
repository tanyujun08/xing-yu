import { AdminLink as Link } from '../../shared/ui/AdminLink';
import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Table, Alert, Button, Space } from 'tdesign-react';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';
import type { CouponsPolicy, LoyaltyConfigConflict, LoyaltyConfigVersion, LoyaltyConfigKey, LoyaltyEffectiveConfig, LoyaltyEffectiveResult, LoyaltySaveRequest, LoyaltySaveResult } from '../../shared/services/loyaltyManagement';
import type { BusinessVersion } from '../../shared/services/businessConfiguration';
import { isLoyaltySaveRejected, loyaltyFailure } from '../../shared/services/loyaltyFailure';
import { parseLoyaltyInteger, validateLoyaltyStock } from './loyaltyInputs';
import { PageHeader } from '../../shared/ui/PageHeader';
import { DetailSurface, DetailDefinitionList } from '../../shared/ui/DetailSurface';
import { AdminTabs, AdminTabPanel } from '../../shared/ui/AdminTabs';
import { formatUTC } from '../../shared/format/time';
import { hasLoyaltyAccess } from './loyaltyAccess';
import { couponDraft, lotteryDraft, isCouponsPolicy, isLotteryPolicy, isLoyaltySaveRequest, parseCouponDraft, parseLotteryDraft, policySummary, policyDifferences, prizeLabel, prizeCodes, type LoyaltyDraft } from './loyaltyPolicies';
import { LoyaltySaveIntentStore, type LoyaltySaveIntent } from './loyaltySaveIntent';
import { LoyaltySaveRecovery } from './LoyaltySaveRecovery';
import { LoyaltySaveReview } from './LoyaltySaveReview';
import { CouponPolicyFields, LotteryPolicyFields } from './LoyaltyPolicyFields';
import { LoyaltyRecords } from './LoyaltyRecords';
import { LoyaltyDetailDrawer } from './LoyaltyDetailDrawer';
import { loyaltyDetailHref } from './loyaltyDetailLinks';
import './loyalty-management.css';

export function CouponsSettingsPage() { return <LoyaltyManagementPage key="benefits.coupons" configKey="benefits.coupons" />; }
export function LotteryPrizesSettingsPage() { return <LoyaltyManagementPage key="benefits.lottery" configKey="benefits.lottery" />; }
const clone = <T,>(value: T): T => structuredClone(value);

function ConfigConflictSources({ conflicts }: { conflicts: readonly LoyaltyConfigConflict[] }) {
  const session = useSession(); const services = useAdminServices();
  const [selected, setSelected] = useState<LoyaltyConfigConflict | null>(null);
  const allowed = hasLoyaltyAccess(session, 'ops.system_config.read');
  const version = useQuery<BusinessVersion | LoyaltyConfigVersion | null>({
    queryKey: ['loyalty-conflict-source-version', session.accountId, selected?.source_config_key, selected?.source_config_version_id],
    enabled: selected !== null && allowed, retry: false,
    queryFn: async ({ signal }) => {
      if (selected === null) throw new Error('尚未选择来源版本。');
      const sourceKey = selected.source_config_key; const sourceVersion = selected.source_config_version_id;
      let cursor = ''; const cursors = new Set(['']); const ids = new Set<string>();
      while (true) {
        const data = sourceKey === 'benefits.lottery'
          ? await (() => { if (!services.loyaltyManagement) throw new Error('来源版本读取服务未接入。'); return services.loyaltyManagement.versions(sourceKey, cursor, signal); })()
          : await (() => { if (!services.businessConfig) throw new Error('来源版本读取服务未接入。'); return services.businessConfig.versions(sourceKey, cursor, signal); })();
        if (!Array.isArray(data.items) || !data.page) throw new Error('来源版本分页结构无法核对。');
        let nextCursor: string | null;
        if (sourceKey === 'benefits.lottery') {
          if (typeof data.page.next_cursor !== 'string' && data.page.next_cursor !== null) throw new Error('来源版本分页结构无法核对。');
          nextCursor = data.page.next_cursor;
        } else {
          if (!('has_more' in data.page) || typeof data.page.has_more !== 'boolean') throw new Error('来源版本分页结构无法核对。');
          if (data.page.has_more && typeof data.page.next_cursor !== 'string') throw new Error('来源版本分页游标无法核对。');
          nextCursor = data.page.has_more ? data.page.next_cursor ?? null : null;
        }
        for (const row of data.items) {
          if (!row || row.config_key !== sourceKey || typeof row.config_version_id !== 'string' || row.config_version_id === '' || ids.has(row.config_version_id)) throw new Error('来源版本身份无法核对。');
          ids.add(row.config_version_id);
        }
        if (nextCursor !== null && (nextCursor === '' || cursors.has(nextCursor))) throw new Error('来源版本分页游标无法核对。');
        const found = data.items.find((row) => row.config_version_id === sourceVersion);
        if (found) return found;
        if (nextCursor === null) return null;
        cursor = nextCursor; cursors.add(cursor);
      }
    },
  });
  return <DetailSurface title="服务端配置来源冲突" description="以下字段和冻结版本来自本次服务端拒绝；本地草稿已保留。来源版本详情只读。">
    <section aria-label="本次拒绝的配置来源"><h4>本次拒绝的配置来源</h4><Table ref={(table) => table?.tableHtmlElement?.setAttribute('aria-label', '本次拒绝的配置来源')} className="loyalty-difference-table" rowKey="_tdesignRowKey" size="small" data={(conflicts ?? []).map((item) => ({ ...item, _tdesignRowKey: `${item.field}:${item.source_kind}:${item.source_config_key}:${item.source_config_version_id}` }))} columns={[
{ colKey: 'column1', title: <>field</>, cell: ({ row: item }) => <>{item.field}</> },
{ colKey: 'column2', title: <>coupon_type</>, cell: ({ row: item }) => <>{item.coupon_type}</> },
{ colKey: 'column3', title: <>source_kind</>, cell: ({ row: item }) => <>{item.source_kind}</> },
{ colKey: 'column4', title: <>source_config_key</>, cell: ({ row: item }) => <>{item.source_config_key}</> },
{ colKey: 'column5', title: <>source_config_version_id</>, cell: ({ row: item }) => <span className="mono-value">{item.source_config_version_id}</span> },
{ colKey: 'column6', title: <>查看来源</>, cell: ({ row: item }) => <><Button tag="button" onClick={() => setSelected(item)} aria-label={`查看冻结版本 ${item.source_kind} ${item.source_config_version_id}`}>查看冻结版本</Button>
          {item.source_kind === 'LOTTERY' ? <Link href="/settings/lottery-prizes?tab=current" target="_blank" rel="noopener noreferrer">打开抽奖配置</Link> : item.source_kind === 'CHECK_IN' ? <Link href="/settings/loyalty?tab=daily-sign-in" target="_blank" rel="noopener noreferrer">打开签到配置</Link> : <span>CATALOG 来源仅提供冻结版本只读详情。</span>}
        </> }
]} /></section>
    {selected ? <section aria-label="来源冻结版本详情">
      <h3>来源冻结版本详情</h3><p>{selected.source_config_key} · {selected.source_config_version_id}</p>
      {!allowed ? <Alert theme="warning" message="当前账号没有来源版本读取权限；未请求该版本。" /> : version.isPending ? <p role="status">正在读取来源冻结版本…</p> : version.isError ? <Alert theme="error" message={`来源冻结版本读取失败：${loyaltyFailure(version.error).message}`} operation={<Button tag="button" onClick={() => void version.refetch()}>重试读取冻结版本</Button>} /> : version.data === null ? <Alert theme="warning" message="未找到服务端指定的冻结版本；不会以当前版本替代。" /> : version.data ? <DetailDefinitionList columns={1}>
        <div><dt>config_key</dt><dd>{version.data.config_key}</dd></div><div><dt>config_version_id</dt><dd>{version.data.config_version_id}</dd></div>
        <div><dt>content_hash</dt><dd>{version.data.content_hash}</dd></div><div><dt>reason</dt><dd>{version.data.reason}</dd></div><div><dt>value</dt><dd><pre>{JSON.stringify(version.data.value, null, 2)}</pre></dd></div>
      </DetailDefinitionList> : null}
    </section> : null}
  </DetailSurface>;
}

function hasLotteryInventorySnapshot(data: LoyaltyEffectiveResult): boolean {
  const inventory = data.inventory;
  if (!Array.isArray(inventory) || inventory.length !== prizeCodes.length || !prizeCodes.every((code) => inventory.filter((row) => row?.prize_code === code).length === 1)) return false;
  return inventory.every((row) => {
    if (!row || typeof row.total_qty !== 'string' || typeof row.issued_qty !== 'string' || typeof row.remaining_qty !== 'string' || typeof row.version !== 'string') return false;
    const total = validateLoyaltyStock(row.total_qty, row.issued_qty, false);
    const remaining = parseLoyaltyInteger(row.remaining_qty); const version = parseLoyaltyInteger(row.version, data.current !== null);
    return total.ok && remaining.ok && version.ok && BigInt(total.value) - BigInt(row.issued_qty) === BigInt(remaining.value);
  });
}
function LoyaltyManagementPage({ configKey }: { configKey: LoyaltyConfigKey }) {
  const session = useSession(); const services = useAdminServices(); const [search, setSearch] = useSearchParams();
  const coupons = configKey === 'benefits.coupons'; const title = coupons ? '优惠券管理' : '抽奖奖品管理';
  const tabs = coupons ? [{ value: 'current', label: '当前配置' }, { value: 'coupons', label: '领取记录' }, { value: 'redemptions', label: '兑换尝试' }, { value: 'versions', label: '保存历史' }] : [{ value: 'current', label: '当前配置' }, { value: 'attempts', label: '抽奖尝试' }, { value: 'movements', label: '库存变更' }, { value: 'versions', label: '保存历史' }];
  const tab = search.get('tab') ?? 'current'; const validTab = tabs.some((item) => item.value === tab);
  const allowed = hasLoyaltyAccess(session, 'ops.system_config.read'); const canSave = hasLoyaltyAccess(session, 'ops.business_config.publish');
  const recordIdentity = new URLSearchParams(search); recordIdentity.delete('detail_kind'); recordIdentity.delete('detail_id');
  return <div className="page-stack"><PageHeader title={title} description={coupons ? '四种固定券统一管理；已领取优惠券保留领取时权益。' : '主奖池统一配置，库存按实际发放与保存结果回读。'} />
    {!allowed ? <Alert theme="warning" message="仅当前平台超级管理员且具有配置读取权限的账号可访问。" /> : services.loyaltyManagement === undefined ? <Alert theme="warning" message="配置服务尚未连接，请使用 API 环境。" /> : <>
      <AdminTabs value={validTab ? tab : 'current'} onChange={(value) => setSearch(new URLSearchParams({ tab: String(value) }))}>{tabs.map((item) => <AdminTabPanel key={item.value} value={item.value} label={item.label} />)}</AdminTabs>
      {!validTab ? <Alert theme="error" message="页面标签无效，请重新选择标签。" /> : tab === 'current' ? <LoyaltyConfiguration key={`${configKey}:${session.accountId ?? ''}`} configKey={configKey} canSave={canSave} /> : <LoyaltyRecords key={`${configKey}:${session.accountId ?? ''}:${recordIdentity}`} kind={tab as 'coupons' | 'redemptions' | 'versions' | 'attempts' | 'movements'} configKey={configKey} />}
      <LoyaltyDetailDrawer />
    </>}
  </div>;
}
function LoyaltyConfiguration({ configKey, canSave }: { configKey: LoyaltyConfigKey; canSave: boolean }) {
  const services = useAdminServices(); const session = useSession(); const queryClient = useQueryClient();
  const account = session.accountId ?? ''; const couponsPage = configKey === 'benefits.coupons';
  const store = useMemo(() => new LoyaltySaveIntentStore<LoyaltySaveRequest>({ getItem: (key) => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value), removeItem: (key) => window.localStorage.removeItem(key) }, (value): value is LoyaltySaveRequest => isLoyaltySaveRequest(value) && (configKey === 'benefits.coupons' ? isCouponsPolicy(value.value) : isLotteryPolicy(value.value))), [configKey]);
  const [restored] = useState(() => { try { return { intent: store.read(account, configKey), error: '' }; } catch (error) { return { intent: null, error: error instanceof Error ? error.message : '原保存请求无法读取。' }; } });
  const [baseline, setBaseline] = useState<LoyaltyEffectiveConfig | null>(null); const [draft, setDraft] = useState<LoyaltyDraft | null>(null);
  const [reason, setReason] = useState(''); const [review, setReview] = useState(false); const [submitted, setSubmitted] = useState(false); const [pending, setPending] = useState(false);
  const [intent, setIntent] = useState<LoyaltySaveIntent<LoyaltySaveRequest> | null>(restored.intent); const [storageFailure, setStorageFailure] = useState(restored.error);
  const [failure, setFailure] = useState<ReturnType<typeof loyaltyFailure> | null>(null); const [receipt, setReceipt] = useState<LoyaltySaveResult | null>(null);
  const lock = useRef(false);
  const query = useQuery({ queryKey: ['loyalty-effective', account, configKey], retry: false, queryFn: async ({ signal }) => {
    if (services.loyaltyManagement === undefined) throw new Error('配置服务不可用');
    const data = await services.loyaltyManagement.effective(configKey, signal);
    if (data.current !== null && (data.current.config_key !== configKey || !(couponsPage ? isCouponsPolicy(data.current.value) : isLotteryPolicy(data.current.value)))) throw new Error('生效配置结构无法核对，请重试读取。');
    if (!couponsPage && !hasLotteryInventorySnapshot(data)) throw new Error('生效配置同响应库存结构无法核对，请重试读取。');
    return data;
  } });
  const otherKey = couponsPage ? 'benefits.lottery' : 'benefits.coupons';
  const other = useQuery({ queryKey: ['loyalty-effective', account, otherKey], retry: false, queryFn: async ({ signal }) => {
    if (services.loyaltyManagement === undefined) throw new Error('关联配置服务不可用');
    const data = await services.loyaltyManagement.effective(otherKey, signal);
    if (data.current !== null && (data.current.config_key !== otherKey || !(couponsPage ? isLotteryPolicy(data.current.value) : isCouponsPolicy(data.current.value)))) throw new Error('关联配置结构无法核对。');
    if (couponsPage && !hasLotteryInventorySnapshot(data)) throw new Error('关联奖池同响应库存结构无法核对。');
    return data;
  } });
  const current = query.data?.current ?? null;
  const currentValue = current?.value ?? null;
  const currentEpoch = current?.effective_epoch ?? '0'; const baselineEpoch = baseline?.effective_epoch ?? '0';
  const couponPolicy: CouponsPolicy | null = !couponsPage && isCouponsPolicy(other.data?.current?.value) ? other.data.current.value : null;
  const stock = query.data?.inventory ?? [];
  const exhausted = isLotteryPolicy(currentValue) && currentValue.enabled ? currentValue.prizes.filter((row) => row.enabled && row.probability_bps > 0 && stock.some((item) => item.prize_code === row.prize_code && item.remaining_qty === '0')) : [];
  const parsed = draft === null ? null : 'coupons' in draft ? parseCouponDraft(draft) : parseLotteryDraft(draft, stock, couponPolicy);
  const dependReady = other.isSuccess && query.isSuccess;
  const epochChanged = draft !== null && query.isSuccess && baselineEpoch !== currentEpoch;
  const draftDifferent = intent !== null && (parsed?.ok ? JSON.stringify(parsed.value) !== JSON.stringify(intent.body.value) || reason !== intent.body.reason : draft !== null);
  const pathname = couponsPage ? '/settings/coupons' : '/settings/lottery-prizes';
  const edit = () => { setBaseline(clone(current)); setDraft(couponsPage ? couponDraft(isCouponsPolicy(currentValue) ? currentValue : null) : lotteryDraft(isLotteryPolicy(currentValue) ? currentValue : null)); setReason(''); setSubmitted(false); setFailure(null); };
  const send = async (original: LoyaltySaveIntent<LoyaltySaveRequest>) => {
    if (lock.current || !canSave || account === '' || services.loyaltyManagement === undefined) return;
    lock.current = true; setPending(true); setFailure(null);
    try {
      const saved = await services.loyaltyManagement.save(configKey, clone(original.body), original.key);
      setReceipt(saved); store.resolve(account, configKey, original.key); setIntent(store.read(account, configKey)); setReview(false);
      if (!draftDifferent) { setDraft(null); setReason(''); }
      await Promise.all([query.refetch(), other.refetch()]);
      void queryClient.invalidateQueries({ queryKey: ['loyalty-records', account] });
    } catch (error) {
      const info = loyaltyFailure(error); setFailure(info); setReview(false);
      if (isLoyaltySaveRejected(error)) { try { store.resolve(account, configKey, original.key); setIntent(null); setReview(false); } catch (clearError) { setStorageFailure(clearError instanceof Error ? clearError.message : '原保存请求清理失败。'); } void query.refetch(); void other.refetch(); }
      throw new Error(info.message, { cause: error });
    } finally { lock.current = false; setPending(false); }
  };
  const confirm = async (normalizedReason: string) => {
    if (parsed?.ok !== true || epochChanged || !dependReady || pending || storageFailure) return;
    const body: LoyaltySaveRequest = { base_effective_epoch: baselineEpoch, value: clone(parsed.value), reason: normalizedReason };
    let original: LoyaltySaveIntent<LoyaltySaveRequest>;
    try { original = store.begin(account, configKey, body); setIntent(original); }
    catch (error) { setStorageFailure(error instanceof Error ? error.message : '无法保全原保存请求。'); setReview(false); return; }
    if (JSON.stringify(original.body) !== JSON.stringify(body)) { setReview(false); return; }
    await send(original);
  };
  const preview = () => { setSubmitted(true); if (parsed?.ok !== true || epochChanged || !dependReady || intent !== null || storageFailure) return; setReview(true); };
  const relatedFailure = other.isError;
  return <div className="page-stack">
    {storageFailure ? <Alert theme="error" message={storageFailure} /> : null}
    {failure ? <Alert theme="error" message={`${failure.message}${failure.requestId === null ? '' : ` 请求编号：${failure.requestId}`}`} /> : null}
    {failure?.configConflictError ? <Alert theme="error" message={failure.configConflictError} /> : null}
    {failure && failure.configConflicts.length > 0 ? <ConfigConflictSources key={`${failure.requestId}:${JSON.stringify(failure.configConflicts)}`} conflicts={failure.configConflicts} /> : null}
    {receipt ? <Alert theme="success" message={query.isSuccess && query.data.current?.config_version_id !== receipt.config_version_id ? '保存已确认；另一位管理员随后更新了配置，页面展示最新生效值。' : '保存已确认；当前配置以最新回读为准。'} operation={<Link href={loyaltyDetailHref('config-version', receipt.config_version_id, pathname)}>查看本次保存版本</Link>} /> : null}
    {intent === null ? null : <LoyaltySaveRecovery intent={intent} describeOriginal={(body) => ({ baselineEpoch: body.base_effective_epoch, reason: body.reason, fields: policySummary(body.value) })} draftDifferent={draftDifferent} pending={pending} onRetry={send} auditHref={`/settings/operation-logs?${new URLSearchParams({ object_keyword: configKey })}`} />}
    <DetailSurface title={couponsPage ? '当前优惠券配置' : '当前主奖池配置'} description={query.data ? `数据时间 ${formatUTC(query.data.as_of_at)}` : '读取最新生效配置'} actions={<Space><Button tag="button" disabled={pending || query.isFetching} onClick={() => { void query.refetch(); void other.refetch(); }}>刷新最新配置</Button>{draft === null && canSave ? <Button tag="button" theme="primary" disabled={!query.isSuccess || !dependReady || pending || intent !== null || storageFailure !== ''} onClick={edit}>{current === null ? '配置' : '编辑配置'}</Button> : null}</Space>}>
      {query.isPending ? <p role="status">正在读取生效配置…</p> : query.isError ? <Alert theme="error" message={`生效配置读取失败：${loyaltyFailure(query.error).message}`} /> : <>
        <p>配置版本：{current ? <Link className="mono-value" href={loyaltyDetailHref('config-version', current.config_version_id, pathname)}>{current.config_version_id}</Link> : '尚未配置'} · 生效序号：{currentEpoch}{current ? ` · 保存人：${current.saved_by} · ${formatUTC(current.effective_at)}` : ''}</p>
        {draft === null ? currentValue === null ? <Alert theme="info" message="尚未配置。填写完整配置并保存后生效。" /> : <DetailDefinitionList>{policySummary(currentValue).map((field) => <div key={field.field}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</DetailDefinitionList> : <>
          {epochChanged ? <Alert theme="warning" message="另一位管理员已更新配置，草稿已保留。请核对以下差异，再选择基于最新配置继续编辑。" operation={<Button tag="button" disabled={pending || intent !== null} onClick={() => { setBaseline(clone(current)); setReview(false); setFailure(null); }}>基于最新配置继续编辑</Button>} /> : null}
          {epochChanged && parsed?.ok ? <Table ref={(table) => table?.tableHtmlElement?.setAttribute('aria-label', '配置差异')} className="loyalty-difference-table" rowKey="field" size="small" data={[...(policyDifferences(currentValue, parsed.value) ?? [])]} columns={[
{ colKey: 'column1', title: <>字段</>, cell: ({ row: field }) => <>{field.label}</> },
{ colKey: 'column2', title: <>最新生效值</>, cell: ({ row: field }) => <>{field.before}</> },
{ colKey: 'column3', title: <>本地草稿</>, cell: ({ row: field }) => <>{field.after}</> }
]} /> : null}
          {'coupons' in draft ? <CouponPolicyFields draft={draft} change={setDraft} disabled={pending} submitted={submitted} errors={failure?.fieldErrors ?? {}} /> : <LotteryPolicyFields draft={draft} change={setDraft} inventory={stock} coupons={couponPolicy} disabled={pending} submitted={submitted} errors={failure?.fieldErrors ?? {}} />}
          {submitted && parsed?.ok === false ? <Alert theme="error" message={parsed.message} /> : null}
          <div className="loyalty-edit-footer"><Button tag="button" disabled={pending} onClick={() => { setDraft(null); setReview(false); setFailure(null); }}>取消编辑</Button><Button tag="button" theme="primary" disabled={pending || !canSave || !dependReady || epochChanged || intent !== null || storageFailure !== ''} onClick={preview}>保存并生效</Button></div>
        </>}
      </>}
      {relatedFailure ? <Alert theme="error" message="关联配置或库存读取失败，编辑和保存已暂停；请刷新重试。" /> : !dependReady ? <p role="status">正在读取关联配置与库存…</p> : null}
      {!couponsPage && query.isSuccess && stock.length > 0 ? <section aria-label="服务端最新奖品库存"><h4>服务端最新奖品库存</h4><Table ref={(table) => table?.tableHtmlElement?.setAttribute('aria-label', '服务端最新奖品库存')} className="loyalty-difference-table" rowKey="prize_code" size="small" data={[...(stock ?? [])]} columns={[
{ colKey: 'column1', title: <>奖品</>, cell: ({ row: row }) => <>{prizeLabel(row.prize_code)}</> },
{ colKey: 'column2', title: <>累计总份数</>, cell: ({ row: row }) => <>{row.total_qty}</> },
{ colKey: 'column3', title: <>已发</>, cell: ({ row: row }) => <>{row.issued_qty}</> },
{ colKey: 'column4', title: <>剩余</>, cell: ({ row: row }) => <>{row.remaining_qty}</> },
{ colKey: 'column5', title: <>库存版本</>, cell: ({ row: row }) => <>{row.version}</> }
]} /></section> : null}
      {!couponsPage && exhausted.length > 0 ? <Alert theme="warning" message={'库存暂停：' + exhausted.map((row) => prizeLabel(row.prize_code)).join('、') + '已无剩余份数，当前奖池不能继续抽奖。'} /> : null}
      {!couponsPage && draft === null && currentValue !== null ? <p>谢谢参与正常消耗本次粉钻，不发奖励；库存与权益为“—”。</p> : null}
    </DetailSurface>
    {parsed?.ok ? <LoyaltySaveReview visible={review} version={baseline?.config_version_id ?? null} epoch={baselineEpoch} differences={policyDifferences(baseline?.value ?? null, parsed.value)} impacts={[couponsPage ? '已领取优惠券保留领取时的权益；启用来源引用的券不能直接停用。' : '抽奖按确认版本与库存校验；谢谢参与正常消耗粉钻且不发奖励。', '保存后立即生效，并记录字段差异与保存原因。']} reason={reason} onReasonChange={setReason} onCancel={() => setReview(false)} onConfirm={confirm} pending={pending} error={failure?.message ?? null} /> : null}
  </div>;
}
