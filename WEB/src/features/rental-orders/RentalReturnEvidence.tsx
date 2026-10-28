import { randomId } from '../../shared/randomId';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert, Button, Checkbox, Input, Link, Select, Space, Textarea } from 'tdesign-react';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';
import type { RentalReturn, RentalReviewInput, Versioned } from '../../shared/services/rentalOrders';
import type { StagedMediaFile } from '../../shared/media/demoMedia';
import { MediaUploadField } from '../../shared/ui/MediaUploadField';
import { AdminDisclosure } from '../../shared/ui/AdminDisclosure';
import { RentalFacts, RentalMedia } from './RentalShared';
import { formatUTC } from '../../shared/format/time';

function EvidenceReason({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const input = useRef<ComponentRef<typeof Textarea>>(null);
  useEffect(() => { input.current?.textareaElement?.setAttribute('aria-label', label); input.current?.textareaElement?.setAttribute('aria-required', 'true'); }, [label]);
  return <label>{label}<Textarea ref={input} value={value} maxlength={500} onChange={onChange} /></label>;
}

export function RentalReturnEvidence({ record, disabled, submit }: { record: Versioned<RentalReturn>; disabled: boolean; submit: (run: () => Promise<unknown>) => Promise<void> }) {
  const { data: returned, etag } = record, session = useSession(), gateway = useAdminServices().rentalOrders!;
  const [reason, setReason] = useState(''), [selection, setSelection] = useState(''), [files, setFiles] = useState<StagedMediaFile[]>([]), [uploadBlocked, setUploadBlocked] = useState(false), [resolutionReason, setResolutionReason] = useState('');
  const candidates = returned.evidence_slots.filter(v => v.slot.stage === 'AFTER_OPEN' && v.editable).flatMap(v => Array.from({ length: v.slot.max_count }, (_, i) => ({ slot: v.slot, itemNo: i + 1, key: v.slot.slot_key + ':' + (i + 1) })));
  const selected = candidates.find(v => v.key === selection), task = returned.cabinet_task;
  const resolve = (action: 'RECHECK' | 'RELEASE_EMPTY') => { if (!task || !resolutionReason.trim()) return; const original = structuredClone(task), key = randomId(), body = { action, reason: resolutionReason.trim() }; void submit(() => gateway.resolveReturn(original, body, key)); };
  const supplement = () => { if (!selected || !files[0]?.materialId || !reason.trim() || uploadBlocked) return; const slot = selected.slot.slot_key, number = selected.itemNo, body = { material_id: files[0].materialId, reason: reason.trim() }, key = randomId(); void submit(async () => { const result = await gateway.saveReturnEvidence(returned.order_id, slot, number, body, etag, key); setFiles([]); return result; }); };
  return <Space direction="vertical" style={{ width: '100%' }}>
    <p>凭证模板：{returned.evidence_template.title} · {returned.evidence_template.version}；当前材料版本：{returned.evidence_version}</p>
    {returned.evidence_slots.map(({ slot, items, complete }) => <section key={slot.slot_key}>
      <Space><h3>{slot.title}</h3><span>{complete ? '已齐全' : '待补齐'}</span>{slot.example ? <Link href={slot.example.url} target="_blank">查看示例</Link> : null}</Space>
      <p>{slot.instruction}</p><RentalMedia items={items} />
      <AdminDisclosure title="查看此项更换历史">{returned.evidence_history.filter(v => v.slot_key === slot.slot_key).map(item => <section key={item.evidence_id}><RentalFacts entries={[
        ['第几份 / 修订', `${item.item_no} / ${item.revision_no}`], ['当前使用', item.is_current ? '是' : '否'], ['提交来源', item.source === 'TENANT' ? '承租人' : '官方代补'], ['提交人', item.submitted_by], ['提交时间', formatUTC(item.created_at)], ['更换原因', item.reason],
      ]} /><RentalMedia items={[item]} /></section>)}</AdminDisclosure>
    </section>)}
    {candidates.length && session.permissions.includes('ops.returns.receive') ? <fieldset disabled={disabled}><legend>代补入柜凭证</legend><Space direction="vertical" style={{ width: '100%' }}>
      <p>仅可补充已收回设备的入柜凭证。需上传本人素材并填写原因，原凭证会保留。</p>
      <label>凭证项目<Select value={selection} options={candidates.map(v => ({ value: v.key, label: v.slot.title + ' · 第 ' + v.itemNo + ' 份' }))} onChange={v => { setSelection(String(v)); setFiles([]); }} /></label>
      {selected ? <MediaUploadField key={selection} kind={selected.slot.kind === 'VIDEO' ? 'video' : 'image'} materialClass={selected.slot.kind === 'VIDEO' ? 'EVIDENCE_VIDEO' : 'EVIDENCE_IMAGE'} ownerId={session.accountId} active={!disabled} max={1} label="上传入柜凭证" value={files} onChange={setFiles} onStateChange={v => setUploadBlocked(v.blocked)} /> : null}
      <EvidenceReason label="代补原因（必填）" value={reason} onChange={setReason} />
      <Button tag="button" theme="primary" disabled={disabled || !selected || uploadBlocked || !files[0]?.materialId || !reason.trim()} onClick={supplement}>保存入柜凭证</Button>
    </Space></fieldset> : null}
    {task ? <section><h3>原柜机归还任务</h3><RentalFacts entries={[
      ['租赁柜 / 格口', `${task.cabinet_name} / ${task.compartment_no}号`], ['状态', ({ AWAITING_CONFIRMATION: '等待用户确认', ANOMALY: '归还失败，待客服处理', UNKNOWN: '结果待核实', VERIFYING: '核验中', SUCCEEDED: '归还成功', RESERVED: '等待开柜', EXECUTING: '柜机处理中', CANCELLED: '已取消', FAILED_CONFIRMED: '已安全释放' })[task.status]], ['用户确认', task.verification_requested_at ? formatUTC(task.verification_requested_at) : '尚未确认'], ['柜门', task.door_status], ['设备标签', task.rfid_result],
    ]} />{task.allowed_actions.some(v => v.allowed && ['RECHECK_RETURN', 'RELEASE_EMPTY_RETURN'].includes(v.action_code)) ? <fieldset disabled={disabled}><legend>异常处置</legend><Space direction="vertical" style={{ width: '100%' }}>
      <Alert theme="warning" message="复核只查询原格口，不会再次开门。安全释放仅在新查询确认柜门关闭且空格、没有冲突任务时生效，不会将订单标记为已归还。" />
      <EvidenceReason label="处置原因（必填）" value={resolutionReason} onChange={setResolutionReason} />
      <Space>{task.allowed_actions.filter(v => v.allowed && ['RECHECK_RETURN', 'RELEASE_EMPTY_RETURN'].includes(v.action_code)).map(v => <Button tag="button" key={v.action_code} disabled={disabled || !resolutionReason.trim()} onClick={() => resolve(v.action_code === 'RECHECK_RETURN' ? 'RECHECK' : 'RELEASE_EMPTY')}>{v.action_code === 'RECHECK_RETURN' ? '重新核验原格口' : '核实空格后释放'}</Button>)}</Space>
    </Space></fieldset> : null}</section> : null}
  </Space>;
}

export function RentalMissingEvidence({ returned, value, onChange }: { returned: RentalReturn | undefined; value: RentalReviewInput['missing_items']; onChange: (value: RentalReviewInput['missing_items']) => void }) {
  return <Space direction="vertical" style={{ width: '100%' }}>{returned?.evidence_slots.flatMap(({ slot, items }) => Array.from({ length: slot.max_count }, (_, index) => {
    const itemNo = index + 1, old = items.find(v => v.item_no === itemNo), selected = value.find(v => v.slot_key === slot.slot_key && v.item_no === itemNo);
    const stale = !!selected && selected.evidence_id !== (old?.evidence_id ?? null);
    return <section key={slot.slot_key + ':' + itemNo}><Checkbox checked={!!selected} onChange={checked => onChange(checked ? [...value, { slot_key: slot.slot_key, item_no: itemNo, evidence_id: old?.evidence_id ?? null, reason: '' }] : value.filter(v => v !== selected))}>{slot.title} · 第 {itemNo} 份</Checkbox>
      {selected ? <label>此项补拍要求<Input value={selected.reason} maxlength={500} onChange={reason => onChange(value.map(v => v === selected ? { ...v, reason } : v))} /></label> : null}
      {stale ? <Alert theme="warning" message="该凭证已被更换，请取消勾选并核对最新凭证后重新选择。" /> : null}
    </section>;
  }))}</Space>;
}
