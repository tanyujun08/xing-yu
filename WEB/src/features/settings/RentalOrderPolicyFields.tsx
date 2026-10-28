import { AdminNumberInput } from '../../shared/ui/AdminNumberInput';
import { Alert, Button, Input, Select, Space, Textarea } from 'tdesign-react';
import type { BusinessPolicies } from '../../shared/services/businessConfiguration';
import type { CatalogDirectoryOption } from '../../shared/services/contracts';
type Policy = BusinessPolicies['rental.order_policy'];
type Template = Policy['evidence_templates'][number];
type Slot = Template['slots'][number];
const integer = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;
const key = (v: string) => /^[a-z][a-z0-9-]{0,63}$/.test(v);
const objectKey = (v: string) => /^return-examples\/[A-Za-z0-9_./~-]+$/.test(v) && !v.includes('..');
export const emptyRentalOrderPolicy: Policy = { schema_version: 2, return_instructions: '', pickup_instructions: '', grace_seconds: 0, evidence_templates: [], template_bindings: [], personal_rent_basis_points: 0, loss_beneficiary_basis_points: 0 };
export function validRentalOrderPolicy(value: Policy): boolean {
  if (value.schema_version !== 2 || !value.return_instructions.trim() || value.return_instructions.length > 4000 || value.pickup_instructions.length > 4000 || !integer(value.grace_seconds, 0, 86400) || !integer(value.personal_rent_basis_points, 0, 10000) || !integer(value.loss_beneficiary_basis_points, 0, 10000)) return false;
  const templates = value.evidence_templates;
  if (!templates.length || templates.length > 50 || new Set(templates.map(t => t.template_key)).size !== templates.length) return false;
  for (const t of templates) {
    if (!key(t.template_key) || !t.version.trim() || t.version.length > 64 || !t.title.trim() || t.title.length > 80 || !t.slots.length || t.slots.length > 20 || !t.slots.some(s => s.stage === 'PRE_RETURN') || t.slots.reduce((n, s) => n + s.max_count, 0) > 20 || new Set(t.slots.map(s => s.slot_key)).size !== t.slots.length) return false;
    for (const s of t.slots) {
      if (!key(s.slot_key) || !s.title.trim() || s.title.length > 80 || !s.instruction.trim() || s.instruction.length > 2000 || !integer(s.min_count, 1, 20) || !integer(s.max_count, s.min_count, 20) || !integer(s.sort_order, 0, 1000)) return false;
      const e = s.example;
      if (e && (!objectKey(e.object_key) || !/^[a-f0-9]{64}$/.test(e.sha256) || (s.kind === 'VIDEO' ? e.mime_type !== 'video/mp4' || !e.poster_object_key : !['image/jpeg', 'image/png', 'image/webp'].includes(e.mime_type)) || e.poster_object_key !== null && !objectKey(e.poster_object_key))) return false;
    }
  }
  const bindings = value.template_bindings;
  return bindings.length > 0 && bindings.length <= 200 && new Set(bindings.map(b => [b.supply_channel, b.fulfillment, b.category_id].join(':'))).size === bindings.length && bindings.every(b => b.category_id === b.category_id.trim() && templates.some(t => t.template_key === b.template_key) && (b.supply_channel === 'OFFICIAL_CABINET' ? b.fulfillment === 'CABINET' : b.fulfillment === 'EXPRESS'));
}
function newSlot(index: number): Slot { return { slot_key: 'photo-' + index, title: '', kind: 'PHOTO', stage: 'PRE_RETURN', min_count: 1, max_count: 1, instruction: '', sort_order: index, example: null }; }
export function RentalOrderPolicyFields({ value, onChange, errors = {}, categories = [], categoriesUnavailable = false }: { value: Policy; onChange: (value: Policy) => void; errors?: Record<string, string>; categories?: readonly CatalogDirectoryOption[]; categoriesUnavailable?: boolean }) {
  const updateTemplate = (index: number, template: Template) => onChange({ ...value, evidence_templates: value.evidence_templates.map((t, i) => i === index ? template : t) });
  const updateSlot = (index: number, slotIndex: number, slot: Slot) => { const t = value.evidence_templates[index]!; updateTemplate(index, { ...t, slots: t.slots.map((s, i) => i === slotIndex ? slot : s) }); };
  const numbers = [['grace_seconds', '退押核费超期宽限（秒）', 86400], ['personal_rent_basis_points', '个人租金及超期收益比例（万分比）', 10000], ['loss_beneficiary_basis_points', '损失受益方比例（万分比）', 10000]] as const;
  return <Space direction="vertical" style={{ width: '100%' }}>
    <label>归还说明（必填）<Textarea aria-label="归还说明（必填）" status={errors.return_instructions ? 'error' : 'default'} tips={errors.return_instructions} value={value.return_instructions} maxlength={4000} onChange={return_instructions => onChange({ ...value, return_instructions })} /></label>
    <label>取件说明<Input value={value.pickup_instructions} maxlength={4000} onChange={pickup_instructions => onChange({ ...value, pickup_instructions })} /></label>
    <Space breakLine>{numbers.map(([field, label, max]) => <label key={field}>{label}<AdminNumberInput aria-label={label} aria-invalid={!!errors[field]} min={0} max={max} step={1} required value={Number.isNaN(value[field]) ? '' : value[field]} onChange={v => onChange({ ...value, [field]: v === '' || v === undefined ? Number.NaN : Number(v) })} />{errors[field] ? <span role="alert">{errors[field]}</span> : null}</label>)}</Space>
    <p>租期超时不拦截归还，超期费用在退押环节核定。保存只影响后续新订单，已有订单继续使用成交时的凭证模板。</p>
    {value.evidence_templates.map((template, index) => <fieldset key={index}><legend>凭证模板 {index + 1}</legend><Space direction="vertical" style={{ width: '100%' }}>
      <Space breakLine><label>模板标识<Input value={template.template_key} maxlength={64} onChange={template_key => updateTemplate(index, { ...template, template_key })} /></label><label>模板名称<Input value={template.title} maxlength={80} onChange={title => updateTemplate(index, { ...template, title })} /></label><label>模板版本<Input value={template.version} maxlength={64} onChange={version => updateTemplate(index, { ...template, version })} /></label></Space>
      {template.slots.map((slot, slotIndex) => <fieldset key={slotIndex}><legend>凭证项 {slotIndex + 1}</legend><Space direction="vertical" style={{ width: '100%' }}>
        <Space breakLine><label>槽位标识<Input value={slot.slot_key} maxlength={64} onChange={slot_key => updateSlot(index, slotIndex, { ...slot, slot_key })} /></label><label>凭证标题<Input value={slot.title} maxlength={80} onChange={title => updateSlot(index, slotIndex, { ...slot, title })} /></label>
          <label>凭证类型<Select value={slot.kind} options={[{ value: 'PHOTO', label: '照片' }, { value: 'VIDEO', label: '视频' }]} onChange={kind => updateSlot(index, slotIndex, { ...slot, kind: kind as Slot['kind'], example: null })} /></label>
          <label>拍摄阶段<Select value={slot.stage} options={[{ value: 'PRE_RETURN', label: '归还前' }, { value: 'AFTER_OPEN', label: '开柜后' }]} onChange={stage => updateSlot(index, slotIndex, { ...slot, stage: stage as Slot['stage'] })} /></label></Space>
        <label>拍摄要求<Textarea value={slot.instruction} maxlength={2000} onChange={instruction => updateSlot(index, slotIndex, { ...slot, instruction })} /></label>
        <Space breakLine>{([['min_count', '最少份数'], ['max_count', '最多份数'], ['sort_order', '排序']] as const).map(([field, label]) => <label key={field}>{slot.title || slot.slot_key} {label}<AdminNumberInput aria-label={(slot.title || slot.slot_key) + ' ' + label} value={Number.isNaN(slot[field]) ? '' : slot[field]} min={field === 'sort_order' ? 0 : 1} max={field === 'sort_order' ? 1000 : 20} step={1} onChange={v => updateSlot(index, slotIndex, { ...slot, [field]: v === '' || v === undefined ? Number.NaN : Number(v) })} /></label>)}</Space>
        {slot.example ? <Space direction="vertical" style={{ width: '100%' }}>
          <label>示例 OSS 对象路径<Input value={slot.example.object_key} onChange={object_key => updateSlot(index, slotIndex, { ...slot, example: { ...slot.example!, object_key } })} /></label>
          <label>示例 SHA-256<Input value={slot.example.sha256} maxlength={64} onChange={sha256 => updateSlot(index, slotIndex, { ...slot, example: { ...slot.example!, sha256 } })} /></label>
          <label>示例文件类型<Select value={slot.example.mime_type} options={(slot.kind === 'VIDEO' ? ['video/mp4'] : ['image/jpeg', 'image/png', 'image/webp']).map(v => ({ value: v, label: v }))} onChange={mime_type => updateSlot(index, slotIndex, { ...slot, example: { ...slot.example!, mime_type: mime_type as NonNullable<Slot['example']>['mime_type'] } })} /></label>
          {slot.kind === 'VIDEO' ? <label>视频封面 OSS 对象路径<Input value={slot.example.poster_object_key ?? ''} onChange={poster_object_key => updateSlot(index, slotIndex, { ...slot, example: { ...slot.example!, poster_object_key } })} /></label> : null}
          <Button variant="text" onClick={() => updateSlot(index, slotIndex, { ...slot, example: null })}>移除此项示例</Button>
        </Space> : <Button onClick={() => updateSlot(index, slotIndex, { ...slot, example: { object_key: '', sha256: '', mime_type: slot.kind === 'VIDEO' ? 'video/mp4' : 'image/jpeg', poster_object_key: null } })}>配置已上传的 OSS 示例</Button>}
        <Button variant="text" onClick={() => updateTemplate(index, { ...template, slots: template.slots.filter((_, i) => i !== slotIndex) })}>删除此凭证项</Button>
      </Space></fieldset>)}
      <Button disabled={template.slots.length >= 20} onClick={() => updateTemplate(index, { ...template, slots: [...template.slots, newSlot(template.slots.length + 1)] })}>添加凭证项</Button>
      <Button variant="text" onClick={() => onChange({ ...value, evidence_templates: value.evidence_templates.filter((_, i) => i !== index) })}>删除此模板</Button>
    </Space></fieldset>)}
    <Button disabled={value.evidence_templates.length >= 50} onClick={() => onChange({ ...value, evidence_templates: [...value.evidence_templates, { template_key: 'template-' + Date.now(), title: '', version: '1', slots: [newSlot(1)] }] })}>添加凭证模板</Button>
    <h3>模板适用范围</h3>
    <p>优先使用品类专属模板；未设置专属模板的品类使用同供给与归还方式的通用模板。</p>
    {categoriesUnavailable ? <Alert theme="warning" message="品类列表暂不可用，请重新读取后保存；已填写的模板内容会保留。" /> : null}
    {value.template_bindings.map((binding, index) => { const categoryInputProps = { className: 'return-template-category', 'aria-label': `适用品类 ${index + 1}` }; const change = (next: typeof binding) => onChange({ ...value, template_bindings: value.template_bindings.map((b, i) => i === index ? next : b) }); return <Space key={index} breakLine>
      <label>供给与归还方式<Select value={binding.supply_channel} options={[{ value: 'OFFICIAL_CABINET', label: '官方设备 / 租赁柜' }, { value: 'PERSONAL', label: '个人设备 / 快递' }]} onChange={v => change({ ...binding, supply_channel: v as typeof binding.supply_channel, fulfillment: v === 'OFFICIAL_CABINET' ? 'CABINET' : 'EXPRESS' })} /></label>
      <label>适用品类<Select inputProps={categoryInputProps} filterable disabled={categoriesUnavailable} value={binding.category_id} options={[{ value: '', label: '通用模板（未设置专属的品类）' }, ...categories.map(category => ({ value: category.id, label: category.name })), ...(!binding.category_id || categories.some(category => category.id === binding.category_id) ? [] : [{ value: binding.category_id, label: '原品类已不存在，请重新选择', disabled: true }])]} onChange={category_id => change({ ...binding, category_id: String(category_id) })} /></label>
      {binding.category_id && !categoriesUnavailable && !categories.some(category => category.id === binding.category_id) ? <span role="alert">原品类已不存在，请选择当前品类或通用模板。</span> : null}
      <label>使用模板<Select value={binding.template_key} options={value.evidence_templates.map(t => ({ value: t.template_key, label: t.title || t.template_key }))} onChange={v => change({ ...binding, template_key: String(v) })} /></label>
      <Button variant="text" onClick={() => onChange({ ...value, template_bindings: value.template_bindings.filter((_, i) => i !== index) })}>删除此适用范围</Button>
    </Space>; })}
    <Button disabled={value.template_bindings.length >= 200} onClick={() => onChange({ ...value, template_bindings: [...value.template_bindings, { supply_channel: 'OFFICIAL_CABINET', fulfillment: 'CABINET', category_id: '', template_key: value.evidence_templates[0]?.template_key ?? '' }] })}>添加适用范围</Button>
    <p>同一供给与归还方式只能设置一个通用模板，每个品类只能设置一个专属模板；单个模板最多 20 份凭证。技术大小、时长与扫描规则沿用素材策略。</p>
  </Space>;
}
