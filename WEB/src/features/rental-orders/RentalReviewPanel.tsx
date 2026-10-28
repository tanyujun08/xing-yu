import { randomId } from '../../shared/randomId';
import { AdminDisclosure } from '../../shared/ui/AdminDisclosure';
import { RentalReturnEvidence, RentalMissingEvidence } from './RentalReturnEvidence';
import { AdminDatePicker } from '../../shared/ui/AdminDatePicker';
import { rentalLabel, rentalLabels } from './rentalLabels';
import { useEffect, useId, useRef, useState, type ComponentRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Checkbox, Alert, Button, Input, Select, Space, Textarea, type InputRef } from 'tdesign-react';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';
import type { components } from '../../shared/services/rentalOrders';
import { rentalFailure, rentalServerNow, rentalUnknown, rentalValidationErrors, type RentalOrder, type RentalReviewInput, type Versioned } from '../../shared/services/rentalOrders';
import { DetailSurface } from '../../shared/ui/DetailSurface';
import { MediaUploadField } from '../../shared/ui/MediaUploadField';
import type { StagedMediaFile } from '../../shared/media/demoMedia';
import { formatUTC } from '../../shared/format/time';
import { RentalBlockers, RentalFacts, RentalMedia, RentalPager, RentalReadState, rentalMoney, useRentalVisible } from './RentalShared';
import { beijingInputToUTC, reviewOvertimeValue, systemOvertimeInput, validReview, yuanToFen } from './rentalForm';

// TDesign 1.18 passes arbitrary attributes to its wrapper, so associate
// validation with its documented native input ref rather than the wrapper.
function ReviewAmountInput({ label, value, required, serverError, onChange }: { label: string; value: string; required: boolean; serverError?: string | undefined; onChange: (value: string) => void }) {
  const input = useRef<InputRef>(null); const errorId = useId();
  const [touched, setTouched] = useState(false);
  const incompleteDecimal = /^(?:0|[1-9]\d*)\.$/.test(value);
  const error = serverError || (touched ? value === '' ? (required ? '最终核定必须填写金额，可填 0。' : '') : !incompleteDecimal && yuanToFen(value) === null ? '请输入合法的非负金额，最多两位小数，且不超出系统金额范围。' : '' : '');
  useEffect(() => {
    const element = input.current?.inputElement; if (!element) return;
    element.setAttribute('aria-label', label);
    element.setAttribute('aria-invalid', String(!!error));
    element.setAttribute('aria-required', String(required));
    if (error) element.setAttribute('aria-describedby', errorId); else element.removeAttribute('aria-describedby');
  }, [error, errorId, label, required]);
  return <label style={{ display: 'block' }} data-review-error={serverError ? true : undefined}>{label}<Input ref={input} value={value} onChange={onChange} onBlur={() => { setTouched(true); if (incompleteDecimal) onChange(value + '00'); }} placeholder="最终核定必填，可填 0" status={error ? 'error' : 'default'} />{error ? <span id={errorId} role="alert" style={{ display: 'block', marginTop: 'var(--xy-space-1)', color: 'var(--td-error-color)', fontSize: 'var(--xy-admin-form-help-size)', lineHeight: 'var(--xy-admin-form-help-line-height)' }}>{error}</span> : null}</label>;
}

function ReviewReasonInput({ label, value, error, onChange }: { label: string; value: string; error?: string | undefined; onChange: (value: string) => void }) {
  const input = useRef<ComponentRef<typeof Textarea>>(null); const errorId = useId();
  useEffect(() => {
    const element = input.current?.textareaElement; if (!element) return;
    element.setAttribute('aria-label', label); element.setAttribute('aria-invalid', String(!!error));
    if (error) element.setAttribute('aria-describedby', errorId); else element.removeAttribute('aria-describedby');
  }, [error, errorId, label]);
  return <label data-review-error={error ? true : undefined}>{label}<Textarea ref={input} value={value} maxlength={500} onChange={onChange} status={error ? 'error' : 'default'} />{error ? <span id={errorId} role="alert" style={{ display: 'block', color: 'var(--td-error-color)' }}>{error}</span> : null}</label>;
}

type LossDraft = { id: string; description: string; amount: string; files: StagedMediaFile[]; blocked: boolean };
// Only uncertain original submissions are retained. This is an account-scoped
// UI intent, never a new command, manual settlement, or business status.
const unresolved = new Map<string, () => Promise<unknown>>();
export function RentalReviewPanel({ order, refresh }: { order: Versioned<RentalOrder>; refresh: () => Promise<unknown> }) {
  const session = useSession();
  return <RentalReviewForm key={`${session.accountId}:${order.data.order.order_id}`} order={order} refresh={refresh} />;
}
function RentalReviewForm({ order, refresh }: { order: Versioned<RentalOrder>; refresh: () => Promise<unknown> }) {
  const session = useSession(); const gateway = useAdminServices().rentalOrders!; const client = useQueryClient(); const visible = useRentalVisible();
  const id = order.data.order.order_id; const scope = `${session.accountId}:${id}`;
  const [cursor, setCursor] = useState(''); const [time, setTime] = useState(''); const [note, setNote] = useState(''); const [correction, setCorrection] = useState(false);
  const [decision, setDecision] = useState<RentalReviewInput['decision']>('REVIEW_PENDING'); const [reason, setReason] = useState(''); const [adjustment, setAdjustment] = useState(''); const [overtimeDraft, setOvertime] = useState<string | null>(null);
  const [missing, setMissing] = useState<RentalReviewInput['missing_items']>([]); const [losses, setLosses] = useState<LossDraft[]>([]);
  const [preview, setPreview] = useState<{ body: string; etag: string; value: components['schemas']['ReviewPreview'] } | null>(null);
  const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false); const [unknown, setUnknown] = useState(unresolved.has(scope)); const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const feeFields = useRef<HTMLFieldSetElement>(null);
  const fieldsId = useId();
  const inFlight = useRef(false);
  const canReceive = session.permissions.includes('ops.returns.receive'); const canReview = session.permissions.includes('ops.returns.review');
  const result = useQuery({ queryKey: ['rental-return', session.accountId, id], enabled: !!order.data.return_id && visible, queryFn: ({ signal }) => gateway.returns(id, signal), retry: false, refetchInterval: visible ? 15000 : false, refetchIntervalInBackground: false });
  const history = useQuery({ queryKey: ['rental-reviews', session.accountId, id, cursor], queryFn: ({ signal }) => gateway.reviews(id, cursor, signal), retry: false, enabled: visible });
  const returned = result.isError ? undefined : result.data?.data;
  const final = order.data.bill.finalized;
  const systemCalculation = useQuery({
    queryKey: ['rental-system-overtime', session.accountId, id, order.etag, returned?.version ?? null],
    enabled: canReview && !final && visible && order.data.order.stage === 'ACTIVE' && (!order.data.return_id || !!returned),
    queryFn: ({ signal }) => gateway.preview(id, systemOvertimeInput(returned?.version ?? null), order.etag, signal),
    retry: false, staleTime: Infinity, refetchOnWindowFocus: false,
  });
  const currentSystem = !systemCalculation.isError && systemCalculation.data?.basis_version === order.data.order.version ? systemCalculation.data : undefined;
  const invalidatePreview = () => { setPreview(null); setConfirmed(false); setFieldErrors({}); };
  const overtime = reviewOvertimeValue(overtimeDraft, currentSystem, order.data.order.version);
  const overtimeFen = overtime === '' ? null : yuanToFen(overtime);
  const systemFen = currentSystem?.overtime_fen;
  const adjustmentRequired = systemFen != null && overtimeFen !== null && overtimeFen !== systemFen;
  const applyFieldErrors = (error: unknown) => {
    const known = new Set(['overtime_assessed_fen', 'adjustment_reason', 'rejection_reason', 'missing_items', 'loss_items']);
    setFieldErrors(Object.fromEntries(rentalValidationErrors(error).filter((item) => known.has(item.field)).map((item) => [item.field, item.reason])));
  };
  useEffect(() => {
    if (busy || !Object.keys(fieldErrors).length) return;
    const field = feeFields.current?.querySelector<HTMLElement>('[data-review-error]');
    (field?.querySelector<HTMLElement>('input, textarea, select') ?? field)?.focus();
  }, [fieldErrors, busy]);
  const action = (name: components['schemas']['Action']['action_code']) => [...(returned?.allowed_actions ?? []), ...order.data.order.allowed_actions].find((a) => a.action_code === name);
  const reload = async () => { await Promise.all([refresh(), client.invalidateQueries({ queryKey: ['rental-return', session.accountId, id] }), client.invalidateQueries({ queryKey: ['rental-reviews', session.accountId, id] })]); };
  const submit = async (run?: () => Promise<unknown>) => {
    if (inFlight.current) return;
    const original = unresolved.get(scope); const operation = original ?? run; if (!operation) return;
    inFlight.current = true; setBusy(true); setMessage(''); setFieldErrors({}); unresolved.set(scope, operation);
    try { await operation(); unresolved.delete(scope); setUnknown(false); setPreview(null); setConfirmed(false); setMessage('服务器已保存，请以回读结果为准；审核保存不表示微信到账。'); await reload(); }
    catch (error) { const uncertain = rentalUnknown(error); setUnknown(uncertain); if (!uncertain) unresolved.delete(scope); setMessage(rentalFailure(error)); applyFieldErrors(error); if (!uncertain) { setPreview(null); setConfirmed(false); await reload(); } }
    finally { inFlight.current = false; setBusy(false); }
  };
  const receipt = () => {
    const receivedAt = beijingInputToUTC(time); if (!receivedAt) return;
    const body = correction ? { received_at: receivedAt, reason: note.trim() } : { received_at: receivedAt, note: note.trim() || null };
    const key = randomId();
    if (!result.data) return;
    const etag = result.data.etag;
    void submit(() => correction ? gateway.correctReceipt(id, { received_at: body.received_at, reason: note.trim() }, etag, key) : gateway.receipt(id, { received_at: body.received_at, note: note.trim() || null }, etag, key));
  };
  const input: RentalReviewInput = {
    decision, receipt_version: returned?.version ?? null, overtime_assessed_fen: overtimeFen, adjustment_reason: systemFen != null && overtimeFen === systemFen ? null : adjustment.trim() || null,
    loss_items: losses.map((loss) => ({ description: loss.description.trim(), confirmed_fen: loss.amount === '' ? null : yuanToFen(loss.amount), evidence_ids: loss.files.map((f) => f.materialId!).filter(Boolean) })),
    rejection_reason: decision === 'APPROVE_FINAL' ? null : reason.trim() || null, missing_items: decision === 'MATERIAL_REQUIRED' ? missing : [], evidence_ids: [],
  };
  const bodyJSON = JSON.stringify(input);
  const missingCurrent = decision !== 'MATERIAL_REQUIRED' || missing.every(item => {
    const slot = returned?.evidence_slots.find(entry => entry.slot.slot_key === item.slot_key);
    return !!slot && item.item_no >= 1 && item.item_no <= slot.slot.max_count && item.evidence_id === (slot.items.find(entry => entry.item_no === item.item_no)?.evidence_id ?? null);
  });
  const valid = validReview(input) && missingCurrent && (!adjustmentRequired || !!adjustment.trim()) && (overtime === '' || yuanToFen(overtime) !== null) && losses.every((loss) => !loss.blocked && (loss.amount === '' || yuanToFen(loss.amount) !== null) && loss.files.every((file) => !!file.materialId));
  const previewValid = preview?.body === bodyJSON && preview.etag === order.etag && preview.value.basis_version === order.data.order.version && preview.value.blockers.length === 0;
  const previewFees = async () => {
    if (busy || !valid) return; setBusy(true); setMessage(''); setFieldErrors({}); setConfirmed(false);
    const requested = bodyJSON; const etag = order.etag;
    try { const value = await gateway.preview(id, JSON.parse(requested) as RentalReviewInput, etag); setPreview({ body: requested, etag, value }); } catch (error) { setPreview(null); setMessage(rentalFailure(error)); applyFieldErrors(error); } finally { setBusy(false); }
  };
  const saveReview = () => { const body = structuredClone(input); const etag = order.etag; const key = randomId(); void submit(() => gateway.review(id, body, etag, key)); };
  const receivedAt = beijingInputToUTC(time);
  const observedNow = rentalServerNow(result.data?.serverClock ?? order.serverClock);
  const timeValid = receivedAt !== null && observedNow !== null && Date.parse(receivedAt) <= observedNow && (!order.data.delivery.delivered_at || Date.parse(receivedAt) >= Date.parse(order.data.delivery.delivered_at));
  return <DetailSurface title="归还、收回与官方核费" actions={<Button tag="button" disabled={busy} onClick={() => void reload()}>刷新归还及审核</Button>}>
    {order.data.return_id ? <RentalReadState pending={result.isLoading} error={result.error} retry={() => void result.refetch()} /> : <p>尚未建立归还记录。实际收回与材料审核分别处理。</p>}
    {returned ? <><RentalFacts entries={[
      ['归还方式', returned.method === 'CABINET' ? '租赁柜归还' : '快递寄回'], ['快递公司 / 单号', `${returned.carrier ?? '—'} / ${returned.tracking_no ?? '—'}`], ['归还材料', rentalLabel(rentalLabels.material, returned.material_status)], ['材料提交时间', returned.submitted_at ? formatUTC(returned.submitted_at) : '未提交'], ['实际收回时间', returned.received_at ? formatUTC(returned.received_at) : '尚未收回'], ['收回来源 / 操作人', `${rentalLabel(rentalLabels.receiptSource, returned.receipt_source)} / ${returned.receipt_actor_display_name ?? returned.receipt_actor_id ?? '—'}`], ['收回记录时间', returned.receipt_recorded_at ? formatUTC(returned.receipt_recorded_at) : '—'], ['租客说明', returned.note], ['收回备注', returned.receipt_note],
    ]} />{result.data ? <RentalReturnEvidence record={result.data} disabled={busy || unknown || final} submit={submit} /> : null}<RentalBlockers items={returned.blockers} />{returned.receipt_history.length ? <AdminDisclosure  title={<>收回时间变更历史</>}><ol>{returned.receipt_history.map((entry, index) => <li key={`${entry.recorded_at}:${index}`}><RentalFacts entries={[
      ['原收回时间', formatUTC(entry.old_received_at)], ['更正收回时间', formatUTC(entry.new_received_at)], ['更正原因', entry.reason], ['操作人账号', entry.actor_account_id], ['记录时间', formatUTC(entry.recorded_at)],
    ]} /></li>)}</ol></AdminDisclosure> : null}</> : null}
    {message ? <Alert theme={unknown ? 'warning' : 'info'} message={message} /> : null}
    {unknown ? <Space><p>提交结果尚未确认，保留原请求。先查看当前记录，再恢复原提交；不修改原金额或对象版本。</p><Button tag="button" disabled={busy} loading={busy} onClick={() => void submit()}>恢复原提交</Button></Space> : null}
    {canReceive && !final ? <fieldset disabled={busy || unknown} style={{ border: 0, padding: '16px 0' }}><legend>实际收回</legend>
      {!order.data.return_id ? <Button tag="button" disabled={!action('START_RETURN')?.allowed} onClick={() => { const method = order.data.delivery.method; const key = randomId(); const etag = order.etag; void submit(() => gateway.returnDraft(id, method, etag, key)); }}>建立归还记录（{order.data.delivery.method === 'CABINET' ? '柜机' : '快递'}）</Button> : null}
      {returned ? <Space direction="vertical" style={{ width: '100%' }}>{observedNow === null ? <p role="alert">未取得服务器时间，请刷新归还及审核后填写实际收回时间。</p> : null}{returned.received_at ? <Checkbox  checked={correction} onChange={(nextValue) => setCorrection(nextValue)}>更正实际收回时间</Checkbox> : null}
        {!returned.received_at || correction ? <Space direction="vertical" style={{ width: '100%' }}><label><Space direction="vertical"><span>实际收回时间</span><AdminDatePicker className="rental-date-input" type="datetime-local" aria-describedby={time && !timeValid ? `${fieldsId}-receipt-time-error` : undefined} required value={time} aria-invalid={!!time && !timeValid} onChange={(nextValue) => setTime(nextValue)} /></Space></label>{time && !timeValid ? <p id={`${fieldsId}-receipt-time-error`} role="alert">请填写交付后且不晚于服务器当前时间的有效时间。</p> : null}<label>{correction ? '更正原因（必填）' : '收回备注（选填）'}<Textarea aria-label={correction ? '更正原因（必填）' : '收回备注（选填）'} value={note} maxlength={500} onChange={setNote} /></label><Button tag="button" disabled={!timeValid || (correction && !note.trim()) || !action(correction ? 'CORRECT_RECEIPT' : 'CONFIRM_RECEIPT')?.allowed} onClick={receipt}>{correction ? '保存时间更正' : '确认实际收回'}</Button><p>仅在设备已实际收回后填写。收回停止计费并下架，退押仍需官方核定；不要求检查清单或收回附件。</p></Space> : null}
      </Space> : null}
    </fieldset> : null}
    {canReview && !final ? <fieldset ref={feeFields} disabled={busy || unknown || (!!order.data.return_id && !returned)} style={{ border: 0, padding: '16px 0' }}><legend>费用审核</legend><Space direction="vertical" style={{ width: '100%' }}>
      <label>审核决定<Select value={decision} options={[{ value: 'REVIEW_PENDING', label: '保存待核实' }, { value: 'MATERIAL_REQUIRED', label: '要求补材料' }, { value: 'APPROVE_FINAL', label: '最终核定' }]} onChange={(value) => { invalidatePreview(); setDecision(value as RentalReviewInput['decision']); }} /></label>
      {decision !== 'APPROVE_FINAL' ? <ReviewReasonInput label="原因（必填）" value={reason} error={fieldErrors.rejection_reason} onChange={(value) => { invalidatePreview(); setReason(value); }} /> : null}
      {decision === 'MATERIAL_REQUIRED' ? <div data-review-error={fieldErrors.missing_items ? true : undefined}><Space><RentalMissingEvidence returned={returned} value={missing} onChange={(next) => { invalidatePreview(); setMissing(next); }} /></Space>{fieldErrors.missing_items ? <p id={`${fieldsId}-missing`} role="alert">{fieldErrors.missing_items}</p> : null}</div> : null}
      <p>已收押金：{rentalMoney(order.data.bill.deposit_received_fen)}；系统计费止于实际收回时间。核定金额留空表示待核实，0 元表示确认无费用。</p>
      <RentalReadState pending={systemCalculation.isFetching} error={systemCalculation.error} retry={() => void systemCalculation.refetch()} />
      <p>系统计算超期：{rentalMoney(currentSystem?.overtime_fen)}；核定超期默认采用当前系统金额，已编辑草稿不会被回读覆盖。</p>
      <ReviewAmountInput label="核定超期费（元）" value={overtime} required={decision === 'APPROVE_FINAL'} serverError={fieldErrors.overtime_assessed_fen} onChange={(value) => { invalidatePreview(); setOvertime(value); }} />{adjustmentRequired || fieldErrors.adjustment_reason ? <><ReviewReasonInput label="超期调整原因（与系统金额不同时必填）" value={adjustment} error={fieldErrors.adjustment_reason} onChange={(value) => { invalidatePreview(); setAdjustment(value); }} />{!adjustment.trim() ? <p>核定超期费与系统金额不同，请填写调整原因后继续。</p> : null}</> : null}
      {losses.map((loss, index) => <section key={loss.id}><Space direction="vertical" style={{ width: '100%' }}><h3>损失项 {index + 1}</h3><label>损失说明<Input value={loss.description} maxlength={500} onChange={(description) => { invalidatePreview(); setLosses((rows) => rows.map((v) => v.id === loss.id ? { ...v, description } : v)); }} /></label><ReviewAmountInput label="核定金额（元）" value={loss.amount} required={decision === 'APPROVE_FINAL'} onChange={(amount) => { invalidatePreview(); setLosses((rows) => rows.map((v) => v.id === loss.id ? { ...v, amount } : v)); }} /><MediaUploadField kind="image" materialClass="EVIDENCE_IMAGE" ownerId={session.accountId} active={!busy && !unknown} max={20} label="上传本项损失凭证" value={loss.files} onChange={(files) => { invalidatePreview(); setLosses((rows) => rows.map((v) => v.id === loss.id ? { ...v, files } : v)); }} onStateChange={(state) => setLosses((rows) => rows.find((v) => v.id === loss.id)?.blocked === state.blocked ? rows : rows.map((v) => v.id === loss.id ? { ...v, blocked: state.blocked } : v))} /><Button tag="button" variant="text" onClick={() => { invalidatePreview(); setLosses((rows) => rows.filter((v) => v.id !== loss.id)); }}>删除损失项</Button></Space></section>)}
      <Button tag="button" disabled={losses.length >= 100} onClick={() => { invalidatePreview(); setLosses([...losses, { id: randomId(), description: '', amount: '', files: [], blocked: false }]); }}>添加损失项</Button>
      {fieldErrors.loss_items ? <p tabIndex={-1} data-review-error role="alert" aria-label="损失项校验错误">{fieldErrors.loss_items}</p> : null}
      {decision === 'APPROVE_FINAL' ? <><Button tag="button" disabled={!valid || !action('PREVIEW_REVIEW')?.allowed} onClick={() => void previewFees()}>预览最终费用</Button>{preview && preview.body === bodyJSON ? <><RentalFacts entries={[
        ['已收押金', rentalMoney(preview.value.deposit_fen)], ['系统计算超期', rentalMoney(preview.value.overtime_fen)], ['本次核定超期', rentalMoney(input.overtime_assessed_fen)], ['核定损失合计', rentalMoney(preview.value.loss_fen)], ['押金扣抵', rentalMoney(preview.value.deducted_fen)], ['应退押金', rentalMoney(preview.value.refund_due_fen)], ['应补缴', rentalMoney(preview.value.supplement_due_fen)],
      ]} /><RentalBlockers items={preview.value.blockers} /></> : null}<Checkbox  checked={confirmed && previewValid} disabled={!previewValid} onChange={(nextValue) => setConfirmed(nextValue)}>确认本版归还材料合格及最终费用；提交后金额冻结，按结果退押或补缴。</Checkbox><Button tag="button" theme="primary" disabled={!valid || !confirmed || !previewValid || !action('SUBMIT_REVIEW')?.allowed} onClick={saveReview}>确认最终核定</Button></> : <Button tag="button" theme="primary" disabled={!valid || !action('SUBMIT_REVIEW')?.allowed} onClick={saveReview}>保存{decision === 'MATERIAL_REQUIRED' ? '补材料要求' : '待核实'}</Button>}
    </Space></fieldset> : final ? <Alert theme="info" message="已完成最终核定，费用不可修改；请在资金记录查看实际到账状态。" /> : null}
    <section><h3>审核历史</h3><RentalReadState pending={history.isLoading} error={history.error} retry={() => void history.refetch()} empty={history.data?.items.length === 0} />{!history.isError ? history.data?.items.map((review) => <AdminDisclosure key={review.review_id} title={<>{rentalLabel(rentalLabels.decision, review.decision)} · {formatUTC(review.created_at)} · {review.actor_display_name ?? review.actor_account_id}</>}><RentalFacts entries={[
      ['审核版本', review.review_no], ['系统超期', rentalMoney(review.overtime_calculated_fen)], ['核定超期', rentalMoney(review.overtime_assessed_fen)], ['核定损失', rentalMoney(review.loss_confirmed_fen)], ['当时扣抵', rentalMoney(review.allocation.deducted_fen)], ['当时应退', rentalMoney(review.allocation.refund_due_fen)], ['当时应补', rentalMoney(review.allocation.supplement_due_fen)], ['原因', review.assessment.rejection_reason ?? review.assessment.adjustment_reason],
    ]} /><RentalMedia items={review.assessment.evidence} />{review.assessment.loss_items.map((loss, index) => <section key={index}><p>{loss.description}：{rentalMoney(loss.confirmed_fen)}</p><RentalMedia items={loss.evidence} /></section>)}</AdminDisclosure>) : null}<RentalPager cursor={cursor} next={history.data?.next_cursor} busy={history.isFetching} change={setCursor} /></section>
  </DetailSurface>;
}
