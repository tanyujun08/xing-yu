import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Link, Alert, Button, Drawer } from 'tdesign-react';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';
import { isLoyaltyDetailKind, type LoyaltyDetailKind } from '../../shared/services/loyaltyManagement';
import { loyaltyFailure } from '../../shared/services/loyaltyFailure';
import { DetailDefinitionList } from '../../shared/ui/DetailSurface';
import { formatUTC } from '../../shared/format/time';
import { hasLoyaltyAccess } from './loyaltyAccess';
import { validLoyaltyId } from './loyaltyInputs';
import { closeLoyaltyDetail, openLoyaltyDetail } from './loyaltyRecordUrl';
import { couponLabels, couponRightsText, prizeCodes, prizeLabel } from './loyaltyPolicies';
import type { CouponRights, CouponType } from '../../shared/services/loyaltyManagement';

const detailTitles: Record<LoyaltyDetailKind, string> = { coupon: '优惠券详情', 'lottery-attempt': '抽奖尝试详情', redemption: '发布券兑换详情', 'redemption-attempt': '兑换尝试详情', grant: '来源发奖详情', 'pink-entry': '粉钻账变详情', 'quota-movement': '发布额度账变详情', 'inventory-movement': '奖品库存变更详情', 'config-version': '配置版本详情', 'operation-event': '配置操作审计详情', 'check-in': '签到来源详情' };
const labels: Record<string, string> = {
  coupon_id: '优惠券编号', coupon_ids: '发放优惠券', account_id: '所属账号', coupon_type: '券种', rights_snapshot: '领取时权益', status: '优惠券状态', source_grant_id: '来源发奖编号', source_kind: '来源类型', source_id: '来源记录', source_draw_id: '来源抽奖记录', coupon_config_version_id: '领取时优惠券配置版本', issued_at: '领取时间', version: '记录版本', allowed_actions: '当前允许操作', can_redeem: '允许兑换', status_events: '状态事件', event_id: '事件编号', from_status: '原状态', to_status: '新状态', action: '动作', redemption_id: '兑换编号', entitlement_lot_id: '额度批次', movement_id: '账变编号', actor_kind: '操作主体', request_id: '请求编号', occurred_at: '发生时间',
  attempt_id: '尝试编号', draw_id: '抽奖记录编号', state: '处理状态', result_kind: '抽奖结果', reason_code: '原因码', confirmed_cost_pink_units: '确认时粉钻消耗', cost_pink_units: '实际粉钻消耗', prize_code: '奖品', prize_snapshot: '中奖时奖品权益', pink_spend_entry_id: '粉钻支出', pink_reward_entry_id: '粉钻奖励', balance_after: '完成后粉钻余额', grant_id: '发奖编号', inventory_movement_id: '库存变更', confirmed_lottery_config_version_id: '确认时奖池版本', confirmed_coupon_config_version_id: '确认时优惠券版本', received_at: '接收时间', resolved_at: '终态时间', lease_expires_at: '处理中期限', replayed: '幂等重放', quantity: '数量', available_before_qty: '变更前可用数量', available_after_qty: '变更后可用数量', expected_coupon_version: '确认时券版本',
  source_rule_version_id: '来源规则版本', source_award_ordinal: '来源奖励序号', reward_kind: '奖励类型', reward_code: '奖励码', reward_units: '奖励数量', created_at: '创建时间', pink_entry_ids: '粉钻账变', entry_id: '账变编号', point_kind: '积分类型', account_sequence: '账号账变序号', available_delta: '可用变化', available_before: '变更前可用', available_after: '变更后可用', reserved_after: '变更后冻结', reserved_delta: '冻结变化', earned_delta: '累计所得变化', kind: '权益类型', lot_id: '权益批次', source_redemption_id: '来源兑换编号', before_total_qty: '变更前累计总份数', after_total_qty: '变更后累计总份数', before_issued_qty: '变更前已发份数', after_issued_qty: '变更后已发份数', config_version_id: '配置版本', actor_account_id: '操作人账号',
  config_key: '配置键', effective_epoch: '生效序号', value: '该版本配置', saved_by: '保存人', effective_at: '生效时间', reason: '保存原因', content_hash: '内容校验值', operation_event_id: '关联操作审计', field_changes: '字段差异', inventory_movements: '同步库存变更', field: '字段', before_value: '原值', after_value: '新值', operation_id: '接口操作', resource_id: '业务对象', http_status: '响应状态', result_code: '结果码', reason_summary: '操作原因', field_change_summary: '变更摘要', result: '保存返回结果', base_effective_epoch: '保存基线序号', current_effective_epoch: '当前生效序号', current: '保存时配置', inventory: '保存时库存', as_of_at: '数据时间', enabled: '启用', insurance_discount_fen: '保障费用抵扣（分）', no_win_probability_bps: '谢谢参与概率（基点）', probability_bps: '概率（基点）', total_qty: '累计总份数', issued_qty: '已发份数', remaining_qty: '剩余份数', pink_reward_units: '粉钻奖励数量', pool_code: '奖池', coupons: '优惠券配置', prizes: '奖品配置', rights: '权益', currency: '币种', deposit_waiver: '免押范围', publish_quota_qty: '发布额度', rent_day_qty: '租金天数', message: '服务说明', code: '错误码', details: '错误详情', check_in_id: '签到编号', business_date: '业务日期', streak_days: '连续签到天数', rule_version_id: '签到规则版本', rewards: '来源奖励', checkin_day: '签到日期', timezone: '时区', schema_version: '结构版本', units: '数量', coupon_type_snapshot: '领取券种',
};
const enumLabels: Record<string, string> = { AVAILABLE: '可用', REDEEMED: '已兑换', RECEIVED: '已接收', VERIFYING: '处理中', REJECTED: '已拒绝', COMPLETED: '已完成', WIN: '中奖', NO_WIN: '谢谢参与', CHECK_IN: '每日签到', PROGRESS: '成长进度', REDEMPTION: '兑换', LOTTERY: '抽奖', ISSUED: '已领取', TOTAL_ADJUSTED: '调整累计总量', PRIZE_GRANTED: '抽奖发放', PINK: '粉钻', GROWTH: '星光', PUBLISH_QUOTA: '发布额度', MAIN: '主奖池', FULL: '全额' };
const detailLinks: Partial<Record<string, LoyaltyDetailKind>> = { coupon_id: 'coupon', coupon_ids: 'coupon', source_grant_id: 'grant', grant_id: 'grant', redemption_id: 'redemption', source_redemption_id: 'redemption', pink_spend_entry_id: 'pink-entry', pink_reward_entry_id: 'pink-entry', pink_entry_ids: 'pink-entry', inventory_movement_id: 'inventory-movement', coupon_config_version_id: 'config-version', confirmed_coupon_config_version_id: 'config-version', confirmed_lottery_config_version_id: 'config-version', config_version_id: 'config-version', operation_event_id: 'operation-event' };
export function LoyaltyDetailFields({ data, onOpen }: { data: object; onOpen: (kind: LoyaltyDetailKind, id: string) => void }) {
  const noWin = 'result_kind' in data && data.result_kind === 'NO_WIN';
  const render = (field: string, value: unknown, owner: object): ReactNode => {
    if (value === null || value === undefined) return '—';
    if (field === 'rights_snapshot' && typeof value === 'object' && 'kind' in value) return couponRightsText(value as CouponRights);
    if (Array.isArray(value)) return value.length === 0 ? '无' : <div className="loyalty-detail-array">{value.map((item: unknown, index) => <div key={index}>{render(field, item, owner)}</div>)}</div>;
    if (typeof value === 'object') return <LoyaltyDetailFields data={value} onOpen={onOpen} />;
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (typeof value !== 'string') return String(value);
    let kind = detailLinks[field];
    if (field === 'attempt_id' && 'draw_id' in owner) kind = 'lottery-attempt';
    if (field === 'attempt_id' && 'expected_coupon_version' in owner) kind = 'redemption-attempt';
    if (field === 'movement_id' && 'entitlement_lot_id' in owner) kind = 'quota-movement';
    if (field === 'source_id' && 'source_kind' in owner && owner.source_kind === 'CHECK_IN') kind = 'check-in';
    if (kind && validLoyaltyId(value)) return <Button tag="button" variant="text" onClick={() => onOpen(kind, value)}>{value}</Button>;
    if ((field === 'draw_id' || field === 'source_draw_id') && validLoyaltyId(value)) return <Link href={`/settings/lottery-prizes?${new URLSearchParams({ tab: 'attempts', draw_id: value })}`}>{value}</Link>;
    if (field.endsWith('_at')) return formatUTC(value);
    if (field === 'coupon_type' && Object.hasOwn(couponLabels, value)) return couponLabels[value as CouponType];
    if (field === 'prize_code' && prizeCodes.some((code) => code === value)) return prizeLabel(value as typeof prizeCodes[number]);
    return enumLabels[value] ?? value;
  };
  return <DetailDefinitionList columns={1}>{Object.entries(data).filter(([field]) => !(noWin && ['prize_code', 'prize_snapshot', 'coupon_id', 'pink_reward_entry_id', 'grant_id', 'inventory_movement_id'].includes(field))).map(([field, value]) => <div key={field}><dt>{labels[field] ?? field}</dt><dd>{render(field, value, data)}</dd></div>)}</DetailDefinitionList>;
}
export function LoyaltyDetailDrawer() {
  const [search, setSearch] = useSearchParams(); const session = useSession(); const services = useAdminServices();
  const kindText = search.get('detail_kind') ?? ''; const id = search.get('detail_id') ?? '';
  const visible = kindText !== '' || id !== ''; const kind = isLoyaltyDetailKind(kindText) ? kindText : null;
  const permission = kind === 'operation-event' ? 'ops.audit.read' : kind === 'config-version' ? 'ops.system_config.read' : 'ops.members.read';
  const allowed = hasLoyaltyAccess(session, permission); const valid = kind !== null && validLoyaltyId(id) && search.getAll('detail_id').length === 1 && search.getAll('detail_kind').length === 1;
  const focus = useRef<HTMLElement | null>(null); const [refresh, setRefresh] = useState(0);
  useEffect(() => { if (visible) focus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }, [visible]);
  const query = useQuery({ queryKey: ['loyalty-exact-detail', session.accountId, kind, id, refresh], enabled: visible && valid && allowed && services.loyaltyManagement !== undefined, retry: false,
    queryFn: ({ signal }) => { if (kind === null || services.loyaltyManagement === undefined) throw new Error('详情服务不可用'); return services.loyaltyManagement.detail(kind, id, signal); } });
  const close = () => { setSearch(closeLoyaltyDetail(search)); requestAnimationFrame(() => focus.current?.focus()); };
  const open = (nextKind: LoyaltyDetailKind, nextId: string) => { const next = openLoyaltyDetail(search, nextKind, nextId); if (next.ok) setSearch(next.value); };
  return <Drawer visible={visible} header={kind === null ? '记录详情' : detailTitles[kind]} size="720px" footer={<Button tag="button" onClick={close}>关闭</Button>} onClose={close}>
    {!valid ? <Alert theme="error" message="记录类型或精确编号无效，请重新打开记录。" /> : !allowed ? <Alert theme="warning" message="当前账号没有读取该详情的超级管理员权限。" /> : services.loyaltyManagement === undefined ? <Alert theme="warning" message="详情服务尚未连接，请使用 API 环境。" /> : query.isPending ? <p role="status">正在读取精确记录…</p> : query.isError ? <Alert theme="error" message={`详情读取失败：${loyaltyFailure(query.error).message}`} operation={<Button tag="button" onClick={() => setRefresh((value) => value + 1)}>重试</Button>} /> : query.data ? <LoyaltyDetailFields data={query.data} onOpen={open} /> : null}
  </Drawer>;
}
