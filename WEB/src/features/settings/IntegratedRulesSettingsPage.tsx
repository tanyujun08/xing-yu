import { randomId } from '../../shared/randomId';
import { AdminNumberInput } from '../../shared/ui/AdminNumberInput';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAdminServices } from '../../shared/services';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { Alert, Button, Input, Space } from 'tdesign-react';
import { AdminTabs, AdminTabPanel } from '../../shared/ui/AdminTabs';
import { PageHeader } from '../../shared/ui/PageHeader';
import type { BusinessEffective, BusinessPolicies } from '../../shared/services/businessConfiguration';
import { BusinessConfigEditor } from './BusinessConfigEditor';
import { SystemConfigurationPanel } from './SystemConfigurationPanel';
import { emptyRentalOrderPolicy, RentalOrderPolicyFields, validRentalOrderPolicy } from './RentalOrderPolicyFields';
import './settings.css';

type Catalog = BusinessPolicies['entitlement.catalog'];
type Offer = Catalog['offers'][number];
const max = 9223372036854775807n;
const positive = (v: string) => /^[1-9]\d*$/.test(v) && BigInt(v) <= max;
const range = (v: number, low: number, high: number) => Number.isInteger(v) && v >= low && v <= high;
function initialCatalog(row: BusinessEffective | undefined): Catalog {
  if (row?.schema_version === 2 && 'offers' in row.value) return structuredClone(row.value) as Catalog;
  if (row && 'offers' in row.value && row.value.schema_version === 1) return { schema_version: 2, offers: row.value.offers.filter((o) => o.kind === 'CONTRACT' || o.kind === 'PUBLISH_QUOTA').map((o) => ({
    offer_code: o.offer_code, name: o.offer_code, cny_price_fen: o.cost_unit === 'CNY' ? o.unit_price : '', pink_price: o.cost_unit === 'PINK_POINT' ? o.unit_price : '',
    min_quantity: o.min_quantity, max_quantity: o.max_quantity, items: [{ kind: o.kind as 'CONTRACT' | 'PUBLISH_QUOTA', quantity: '1', valid_days: o.valid_days }], refund_policy: 'NONE',
  })) };
  return { schema_version: 2, offers: [] };
}
function validCatalog(v: Catalog) {
  return v.offers.length > 0 && v.offers.length <= 100 && new Set(v.offers.map((o) => o.offer_code)).size === v.offers.length
    && v.offers.every((o) => /^[!-~]{1,64}$/.test(o.offer_code) && o.name.trim().length > 0 && positive(o.cny_price_fen) && positive(o.pink_price)
      && range(o.min_quantity, 1, 1000) && range(o.max_quantity, o.min_quantity, 1000)
      && BigInt(o.cny_price_fen) * BigInt(o.max_quantity) <= max && BigInt(o.pink_price) * BigInt(o.max_quantity) <= max
      && o.items.length > 0 && o.items.length <= 2 && new Set(o.items.map((i) => i.kind)).size === o.items.length
      && o.items.every((i) => positive(i.quantity) && BigInt(i.quantity) * BigInt(o.max_quantity) <= max && (i.valid_days === null || range(i.valid_days, 1, 36500))));
}
function MoneyField({ value, change }: { value: string; change: (value: string) => void }) {
  const [draft, setDraft] = useState<{ input: string; stored: string } | null>(null);
  const display = /^\d+$/.test(value) ? `${BigInt(value) / 100n}.${String(BigInt(value) % 100n).padStart(2, '0')}` : '';
  return <label>人民币价格（元）<Input value={draft?.stored === value ? draft.input : display} onChange={(input) => {
    const parts = /^(0|[1-9]\d*)(?:\.(\d{0,2}))?$/.exec(input);
    const stored = parts ? String(BigInt(parts[1] ?? '0') * 100n + BigInt((parts[2] ?? '').padEnd(2, '0'))) : '';
    setDraft({ input, stored }); change(stored);
  }} placeholder="必须大于 0 元" /></label>;
}
function OfferFields({ offer: o, change }: { offer: Offer; change: (v: Offer) => void }) {
  return <Space direction="vertical" style={{ width: '100%' }}><Space breakLine>
    <label>商品名称<Input value={o.name} maxlength={80} onChange={(name) => change({ ...o, name })} /></label>
    <label>商品编号<Input value={o.offer_code} maxlength={64} onChange={(offer_code) => change({ ...o, offer_code })} /></label>
    <MoneyField value={o.cny_price_fen} change={(cny_price_fen) => change({ ...o, cny_price_fen })} />
    <label>粉钻价格（整数）<Input value={o.pink_price} onChange={(pink_price) => change({ ...o, pink_price })} placeholder="必须大于 0" /></label>
    <label>最少购买份数<AdminNumberInput min={1} max={1000} value={o.min_quantity} onChange={(nextValue) => change({ ...o, min_quantity: Number(String(nextValue ?? '')) })} /></label>
    <label>最多购买份数<AdminNumberInput min={1} max={1000} value={o.max_quantity} onChange={(nextValue) => change({ ...o, max_quantity: Number(String(nextValue ?? '')) })} /></label>
  </Space>{o.items.map((item, index) => <Space key={item.kind}>
    <strong>{item.kind === 'CONTRACT' ? '合同' : '发布额度'}</strong>
    <label>每份包含数量<Input value={item.quantity} onChange={(quantity) => change({ ...o, items: o.items.map((i, n) => n === index ? { ...i, quantity } : i) })} /></label>
    <label>有效天数（留空为长期）<AdminNumberInput min={1} max={36500} value={item.valid_days ?? ''} onChange={(nextValue) => change({ ...o, items: o.items.map((i, n) => n === index ? { ...i, valid_days: String(nextValue ?? '') === '' ? null : Number(String(nextValue ?? '')) } : i) })} /></label>
  </Space>)}</Space>;
}
export function IntegratedRulesSettingsPage() {
  const [tab, setTab] = useState('pay-score');
  const services = useAdminServices();
  const queryKeys = useAdminQueryKeys();
  const categories = useQuery({ queryKey: queryKeys.resource('catalog', 'categories'), enabled: tab === 'rental-minimums', queryFn: ({ signal }) => services.catalog.listCategories({ signal }), retry: false });
  // Read query state during this render, before the editor's async child render.
  const categoriesReady = categories.isSuccess;
  const availableCategories = categories.data ?? [];
  return <div className="page-stack"><PageHeader title="规则配置" description="业务规则保存后立即生效，保留版本及操作审计；已有订单继续使用原快照。" />
    <AdminTabs value={tab} onChange={(v) => setTab(String(v))}>
      <AdminTabPanel value="pay-score" label="支付分免押" /><AdminTabPanel value="rental-minimums" label="租赁基础配置" /><AdminTabPanel value="contract" label="合同价格" /><AdminTabPanel value="quota" label="发布额度价格" /><AdminTabPanel value="packages" label="组合套餐" /><AdminTabPanel value="security" label="安全配置审批" />
    </AdminTabs>
    <section hidden={tab !== 'pay-score' && tab !== 'rental-minimums'}>
      <BusinessConfigEditor configKey="rental.creation_defaults" title="租赁基础与支付分配置" description="最短租期仅作新建资产参考，不覆盖存量资产及订单；支付分功能保留并关闭。"
        initial={(r) => r ? structuredClone(r.value) as BusinessPolicies['rental.creation_defaults'] : { schema_version: 1, minimum_hourly_hours: 12, minimum_daily_days: 3, pay_score_enabled: false, pay_score_threshold: null }}
        valid={(v) => v.pay_score_enabled === false && range(v.minimum_hourly_hours, 12, 720) && range(v.minimum_daily_days, 3, 365) && (v.pay_score_threshold === null || range(v.pay_score_threshold, 1, 1000))}>
        {(v, change) => <Space direction="vertical"><div hidden={tab !== 'pay-score'}><Alert theme="info" message="支付分免押当前关闭，阈值仅作保留配置。" /><label>原始支付分阈值<AdminNumberInput min={1} max={1000} value={v.pay_score_threshold ?? ''} onChange={(nextValue) => change({ ...v, pay_score_threshold: String(nextValue ?? '') === '' ? null : Number(String(nextValue ?? '')) })} /></label></div>
          <div hidden={tab !== 'rental-minimums'}><label>按小时最短租期（小时）<AdminNumberInput min={12} max={720} value={v.minimum_hourly_hours} onChange={(nextValue) => change({ ...v, minimum_hourly_hours: Number(String(nextValue ?? '')) })} /></label><label>按天最短租期（天）<AdminNumberInput min={3} max={365} value={v.minimum_daily_days} onChange={(nextValue) => change({ ...v, minimum_daily_days: Number(String(nextValue ?? '')) })} /></label></div>
        </Space>}
      </BusinessConfigEditor>
    </section>
    <section hidden={!['contract', 'quota', 'packages'].includes(tab)}><BusinessConfigEditor configKey="entitlement.catalog" title="合同、发布额度与套餐价格" description="分别保存人民币与粉钻价格，两种价格均须大于零。当前仅开放粉钻购买；人民币支付暂未开放。套餐组成与价格随订单冻结。" initial={initialCatalog} valid={validCatalog}
      reviewNotes={(r) => r && 'offers' in r.value && r.value.schema_version === 1 ? r.value.offers.filter((o) => o.kind !== 'CONTRACT' && o.kind !== 'PUBLISH_QUOTA').map((o) => `${o.offer_code}（${o.kind}）`) : []}>
      {(v, change) => <div>{v.offers.map((offer, index) => <section key={index} hidden={tab === 'packages' ? offer.items.length < 2 : offer.items.length > 1 || offer.items[0]?.kind !== (tab === 'contract' ? 'CONTRACT' : 'PUBLISH_QUOTA')} style={{ padding: 16, borderBottom: '1px solid var(--td-component-stroke)' }}>
        <OfferFields offer={offer} change={(updated) => change({ ...v, offers: v.offers.map((o, i) => i === index ? updated : o) })} /><Button theme="danger" variant="text" onClick={() => change({ ...v, offers: v.offers.filter((_, i) => i !== index) })}>下架此商品</Button>
      </section>)}<Button disabled={v.offers.length >= 100} onClick={() => change({ ...v, offers: [...v.offers, { offer_code: `offer-${randomId().slice(0, 8)}`, name: '', cny_price_fen: '', pink_price: '', min_quantity: 1, max_quantity: 1000, refund_policy: 'NONE', items: (tab === 'packages' ? ['CONTRACT', 'PUBLISH_QUOTA'] as const : [tab === 'contract' ? 'CONTRACT' : 'PUBLISH_QUOTA'] as const).map((kind) => ({ kind, quantity: '1', valid_days: null })) }] })}>新增{tab === 'packages' ? '套餐' : '商品'}</Button></div>}
    </BusinessConfigEditor></section>
    <section hidden={tab !== 'rental-minimums'}>{categories.isError ? <Button variant="outline" onClick={() => void categories.refetch()}>重新读取品类</Button> : null}<BusinessConfigEditor configKey="rental.order_policy" title="订单与归还规则" description="官方设备固定柜取柜还，个人设备固定快递往返；租期不因路途时间顺延。" initial={(row) => row ? structuredClone(row.value) as BusinessPolicies['rental.order_policy'] : { ...emptyRentalOrderPolicy }} valid={value => validRentalOrderPolicy(value) && categoriesReady && value.template_bindings.every(binding => !binding.category_id || availableCategories.some(category => category.id === binding.category_id))}>{(value, onChange, errors) => <RentalOrderPolicyFields value={value} onChange={onChange} errors={errors} categories={availableCategories} categoriesUnavailable={!categoriesReady} />}</BusinessConfigEditor></section>
    <section hidden={tab !== 'security'}><SystemConfigurationPanel /></section>
  </div>;
}
