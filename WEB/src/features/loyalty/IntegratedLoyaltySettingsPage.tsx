import { randomId } from '../../shared/randomId';
import { AdminNumberInput } from '../../shared/ui/AdminNumberInput';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link, Button, Input, Select, Space } from 'tdesign-react';
import type { BusinessEffective, BusinessPolicies, BusinessReward } from '../../shared/services/businessConfiguration';
import { BusinessConfigEditor } from '../settings/BusinessConfigEditor';
import { AdminTabs, AdminTabPanel } from '../../shared/ui/AdminTabs';
import { PageHeader } from '../../shared/ui/PageHeader';
import './loyalty.css';
import { couponLabels, couponTypes } from './loyaltyPolicies';

type Reward = BusinessReward;
type CheckIn = BusinessPolicies['benefits.check_in'];
const integer = (value: string) => /^(0|[1-9]\d*)$/.test(value) && BigInt(value) <= 9223372036854775807n;
function displayUnits(value: string, tenths: boolean): string {
  if (!integer(value) || !tenths) return value;
  const n = BigInt(value); return n % 10n === 0n ? String(n / 10n) : `${n / 10n}.${n % 10n}`;
}
export function RewardUnitsField({ label, value, change, tenths = false }: { label: string; value: string; change: (value: string) => void; tenths?: boolean }) {
  const [draft, setDraft] = useState<{ input: string; stored: string } | null>(null);
  return <label>{label}<Input value={draft?.stored === value ? draft.input : displayUnits(value, tenths)} onChange={(next) => {
    if (!tenths) { change(next); return; }
    if (!/^(0|[1-9]\d*)(\.\d?)?$/.test(next)) { setDraft({ input: next, stored: '' }); change(''); return; }
    const [whole = '0', fraction = ''] = next.split('.');
    const stored = String(BigInt(whole) * 10n + BigInt(fraction || '0')); setDraft({ input: next, stored }); change(stored);
  }} /></label>;
}
function blankReward(kind: 'PINK' | 'GROWTH' | 'COUPON'): Reward {
  return { kind, units: kind === 'COUPON' ? null : '', quantity: kind === 'COUPON' ? 1 : null, coupon_type: null, valid_days: null };
}
function RewardFields({ rewards, change }: { rewards: Reward[]; change: (rewards: Reward[]) => void }) {
  return <div>
    {rewards.map((reward, index) => <Space key={`${index}:${reward.kind}`} breakLine style={{ display: 'flex', margin: '12px 0' }}>
      {reward.kind === 'COUPON' ? <>
        <label>优惠券种类<Select value={reward.coupon_type ?? ''} options={couponTypes.map((value) => ({ value, label: couponLabels[value] }))} onChange={(value) => { const type = couponTypes.find((item) => item === value); if (type) change(rewards.map((r, i) => i === index ? { ...r, coupon_type: type, quantity: 1, units: null, valid_days: null } : r)); }} placeholder="请选择券种" /></label>
        <span>每次固定发放 1 张；领取时确定权益。<Link href="/settings/coupons">查看优惠券配置</Link></span>
      </> : <RewardUnitsField label={reward.kind === 'PINK' ? '粉钻（整数）' : '星光'} value={reward.units ?? ''} tenths={reward.kind === 'GROWTH'} change={(units) => change(rewards.map((r, i) => i === index ? { ...r, units } : r))} />}
      <Button variant="text" theme="danger" onClick={() => change(rewards.filter((_, i) => i !== index))}>删除奖励</Button>
    </Space>)}
    <Space>{(['PINK', 'GROWTH', 'COUPON'] as const).map((kind) => <Button key={kind} disabled={rewards.length >= 20} onClick={() => change([...rewards, blankReward(kind)])}>添加{kind === 'PINK' ? '粉钻' : kind === 'GROWTH' ? '星光' : '优惠券'}</Button>)}</Space>
  </div>;
}
function validRewards(rewards: Reward[]): boolean {
  return rewards.every((r) => r.kind === 'COUPON'
    ? r.coupon_type !== null && couponTypes.includes(r.coupon_type) && r.quantity === 1 && r.units === null && r.valid_days === null
    : (r.kind === 'PINK' || r.kind === 'GROWTH') && integer(r.units ?? ''));
}
function initialCheckIn(row: BusinessEffective | undefined): CheckIn {
  if (row?.schema_version === 2) return structuredClone(row.value) as CheckIn;
  return { schema_version: 2, timezone: 'Asia/Shanghai', daily_rewards: [], first_rewards: [], milestones: [] };
}
function validCheckIn(value: CheckIn): boolean {
  return validRewards(value.daily_rewards) && validRewards(value.first_rewards)
    && new Set(value.milestones.map((m) => m.days)).size === value.milestones.length
    && value.milestones.every((m) => Number.isInteger(m.days) && m.days >= 1 && m.days <= 36500 && validRewards(m.rewards));
}

export function IntegratedLoyaltySettingsPage() {
  const [search, setSearch] = useSearchParams();
  const requestedTab = search.get('tab'); const tab = requestedTab === 'daily-sign-in' || requestedTab === 'streak' ? requestedTab : 'levels';
  return <div className="page-stack">
    <PageHeader title="粉钻、星光与签到" description="粉钻用于消费，星光用于成长等级；两者分别配置，不互相兑换。" />
    <AdminTabs value={tab} onChange={(value) => { const next = new URLSearchParams(search); next.set('tab', String(value)); setSearch(next); }}>
      <AdminTabPanel value="levels" label="等级成长" />
      <AdminTabPanel value="daily-sign-in" label="每日签到" />
      <AdminTabPanel value="streak" label="连续签到" />
    </AdminTabs>
    <section hidden={tab !== 'levels'}>
      <BusinessConfigEditor configKey="membership.levels" title="会员等级成长" description="升级门槛按累计星光配置；粉钻消费和退款不改变星光等级。"
        initial={(row) => row ? structuredClone(row.value) as BusinessPolicies['membership.levels'] : { schema_version: 1, levels: [] }}
        valid={(v) => v.levels.length > 0 && new Set(v.levels.map((l) => l.name.trim())).size === v.levels.length && v.levels.every((l, i) => l.name.trim() !== '' && integer(l.upgrade_growth_units) && (i === 0 ? l.upgrade_growth_units === '0' : BigInt(l.upgrade_growth_units) > BigInt(v.levels[i - 1]?.upgrade_growth_units || '0')))}>
        {(v, change) => <div>{v.levels.map((level, index) => <Space key={level.level_code} breakLine style={{ display: 'flex', marginBottom: 16 }}>
          <label>等级名称<Input value={level.name} onChange={(name) => change({ ...v, levels: v.levels.map((l, i) => i === index ? { ...l, name } : l) })} /></label>
          <RewardUnitsField label="升级所需星光" value={level.upgrade_growth_units} tenths change={(upgrade_growth_units) => change({ ...v, levels: v.levels.map((l, i) => i === index ? { ...l, upgrade_growth_units } : l) })} />
          <span>每月免押次数：{level.waiver_count_per_month}</span>
          <Button theme="danger" variant="text" onClick={() => change({ ...v, levels: v.levels.filter((_, i) => i !== index).map((l, i) => ({ ...l, order: i })) })}>删除等级</Button>
        </Space>)}<Button disabled={v.levels.length >= 20} onClick={() => change({ ...v, levels: [...v.levels, { level_code: `LEVEL_${randomId().slice(0, 8)}`, name: '', order: v.levels.length, upgrade_growth_units: v.levels.length === 0 ? '0' : '', waiver_count_per_month: 0, waiver_mode: 'CAPPED', waiver_cap_fen: '1', eligible_modes: ['DAY'], eligible_categories: [] }] })}>添加等级</Button></div>}
      </BusinessConfigEditor>
    </section>
    <section hidden={tab !== 'daily-sign-in' && tab !== 'streak'}><BusinessConfigEditor configKey="benefits.check_in" title={tab === 'streak' ? '连续签到里程碑' : '每日与首次签到'} description="按北京时间自然日签到；首次奖励终身一次，连续签到节点在每个未中断周期内只发放一次。" initial={initialCheckIn} valid={validCheckIn}>
      {(v, change) => tab === 'streak' ? <div>{v.milestones.map((m, index) => <section key={index} style={{ marginBottom: 20 }}>
        <label>连续签到天数<AdminNumberInput min={1} max={36500} value={m.days} onChange={(nextValue) => change({ ...v, milestones: v.milestones.map((item, i) => i === index ? { ...item, days: Number(String(nextValue ?? '')) } : item) })} /></label>
        <RewardFields rewards={m.rewards} change={(rewards) => change({ ...v, milestones: v.milestones.map((item, i) => i === index ? { ...item, rewards } : item) })} />
        <Button theme="danger" variant="text" onClick={() => change({ ...v, milestones: v.milestones.filter((_, i) => i !== index) })}>删除里程碑</Button>
      </section>)}<Button disabled={v.milestones.length >= 100} onClick={() => change({ ...v, milestones: [...v.milestones, { days: 1, rewards: [] }] })}>添加里程碑</Button></div> : <div>
        <h3>每日首次签到奖励</h3><RewardFields rewards={v.daily_rewards} change={(daily_rewards) => change({ ...v, daily_rewards })} />
        <h3>首次签到额外奖励</h3><RewardFields rewards={v.first_rewards} change={(first_rewards) => change({ ...v, first_rewards })} />
      </div>}
    </BusinessConfigEditor></section>
  </div>;
}
