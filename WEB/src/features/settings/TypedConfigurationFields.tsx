import { AdminNumberInput } from '../../shared/ui/AdminNumberInput';
import { Checkbox } from 'tdesign-react';
import type { ConfigKey, ConfigValues } from '../../shared/services/contracts';
import { materialClassMaxBytes, materialClassMIMEs, materialPolicyClasses } from './configurationDraft';

interface Props {
  selectedKey: ConfigKey;
  values: ConfigValues;
  onChange: (values: ConfigValues) => void;
  disabled: boolean;
}

export function TypedConfigurationFields({ selectedKey, values, onChange, disabled }: Props) {
  const numbers = <K extends ConfigKey>(key: K, fields: readonly { field: keyof ConfigValues[K]; label: string; min: number; max: number }[]) => fields.map(({ field, label, min, max }) => (
    <label key={String(field)} style={{ display: 'inline-flex', gap: 8, margin: '8px 20px 8px 0' }}>
      {label}<AdminNumberInput aria-label={label} disabled={disabled} min={min} max={max} step={1} required value={Number(values[key][field])} onChange={(nextValue) => onChange({ ...values, [key]: { ...values[key], [field]: (nextValue === '' || nextValue === undefined ? Number.NaN : Number(nextValue)) } })} />
    </label>
  ));
  const choices = <T extends string>(label: string, selected: T[], allowed: readonly T[], update: (next: T[]) => void) => (
    <fieldset disabled={disabled}><legend>{label}（至少选择一项）</legend>{allowed.map((value) => <Checkbox disabled={disabled} key={value} style={{ marginRight: 16 }} checked={selected.includes(value)} onChange={(nextValue) => update(nextValue ? [...selected, value] : selected.filter((item) => item !== value))}>{value}</Checkbox>)}</fieldset>
  );
  if (selectedKey === 'material.upload_policy') {
    const policy = values[selectedKey];
    type Limit = typeof policy.class_limits[number];
    const updateLimits = (classLimits: Limit[]) => onChange({ ...values, [selectedKey]: {
      ...policy, class_limits: classLimits, allowed_classes: classLimits.map((limit) => limit.class),
      allowed_mime_types: [...new Set(classLimits.flatMap((limit) => limit.mimes))],
    } });
    const defaultLimit = (materialClass: typeof materialPolicyClasses[number]): Limit => ({
      class: materialClass, mimes: [...materialClassMIMEs(materialClass)],
      max_bytes: Math.min(policy.max_bytes, materialClassMaxBytes(materialClass)),
      processing_required: materialClass === 'EVIDENCE_VIDEO',
      ...(materialClass === 'EVIDENCE_VIDEO' ? { max_duration_ms: 600000 } : {}),
    });
    return <div>
      {numbers(selectedKey, [{ field: 'max_bytes', label: '单文件上限（字节）', min: 1, max: 104857600 }, { field: 'upload_ttl_seconds', label: '上传授权有效秒数', min: 30, max: 900 }])}
      <fieldset disabled={disabled}><legend>素材类型（至少选择一项）</legend>{materialPolicyClasses.map((materialClass) => <Checkbox disabled={disabled} key={materialClass} style={{ marginRight: 16 }} checked={policy.allowed_classes.includes(materialClass)} onChange={(nextValue) => updateLimits(nextValue
          ? [...policy.class_limits, defaultLimit(materialClass)] : policy.class_limits.filter((limit) => limit.class !== materialClass))}>
        {materialClass}
      </Checkbox>)}</fieldset>
      {policy.class_limits.map((limit, index) => {
        const update = (next: Limit) => updateLimits(policy.class_limits.map((item, itemIndex) => itemIndex === index ? next : item));
        return <fieldset key={limit.class} disabled={disabled}><legend>{limit.class} 用途限制</legend>
          {choices(`${limit.class} 格式`, limit.mimes, materialClassMIMEs(limit.class), (next) => update({ ...limit, mimes: next }))}
          <label>{limit.class} 单文件上限（字节）<AdminNumberInput disabled={disabled} aria-label={`${limit.class} 单文件上限（字节）`} min={1} max={Math.min(policy.max_bytes, materialClassMaxBytes(limit.class))} step={1} required value={limit.max_bytes} onChange={(nextValue) => update({ ...limit, max_bytes: (nextValue === '' || nextValue === undefined ? Number.NaN : Number(nextValue)) })} /></label>
          {limit.class === 'EVIDENCE_VIDEO' ? <label>证据视频最大时长（毫秒）<AdminNumberInput disabled={disabled} aria-label="证据视频最大时长（毫秒）" min={1} max={600000} step={1} required value={limit.max_duration_ms ?? ''} onChange={(nextValue) => update({ ...limit, max_duration_ms: (nextValue === '' || nextValue === undefined ? Number.NaN : Number(nextValue)) })} /></label> : null}
          <p>{limit.class === 'EVIDENCE_VIDEO' ? '证据视频必须处理，时长上限最多600000毫秒。' : limit.class.endsWith('_VIDEO') ? '商品和资产视频仅MP4原件，上限100000000字节，不设用途时长限制。' : '图片上限10MiB；SYSTEM_ICON仅PNG或WebP。'}</p>
        </fieldset>;
      })}
      <p>固定安全约束：素材与凭证永久公开；上传后必须扫描，无法关闭；上传与绑定须具备相应权限。</p>
    </div>;
  }
  if (selectedKey === 'identity.profile_policy') return <div>
    {numbers(selectedKey, [{ field: 'display_name_min_length', label: '昵称最少字符', min: 1, max: 64 }, { field: 'display_name_max_length', label: '昵称最多字符', min: 1, max: 64 }])}
    <p>本版语言：zh-CN；头像必须为本人拥有的 READY / PROFILE_IMAGE 素材。</p>
  </div>;
  return <div>
    {numbers(selectedKey, [{ field: 'ttl_seconds', label: '验证码有效秒数', min: 60, max: 600 }, { field: 'cooldown_seconds', label: '发送冷却秒数', min: 30, max: 600 }, { field: 'max_attempts', label: '最大验证次数', min: 3, max: 5 }, { field: 'phone_daily_limit', label: '每号码每日上限', min: 1, max: 65535 }, { field: 'ip_daily_limit', label: '每 IP 每日上限', min: 1, max: 65535 }])}
    {choices('允许场景', values[selectedKey].allowed_scenes, ['OPS_LOGIN', 'PHONE_BIND'], (next) => onChange({ ...values, [selectedKey]: { ...values[selectedKey], allowed_scenes: next } }))}
    <p>固定六位数字。PHONE_BIND 仅登记；后台登录使用已配置的真实短信渠道。策略不会延长已有验证码或重置配额。</p>
  </div>;
}
