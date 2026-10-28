import type { OwnCoupon } from '../model/api-coupon';
import { formatDateTime } from '../format/date-time';
import { couponTitles, rightsText } from './loyalty';
export function presentOwnCoupon(item: OwnCoupon) {
  if (item.rights_snapshot.kind!==item.coupon_type) throw new Error('券权益快照类型不一致。');
  return {id:item.coupon_id,title:couponTitles[item.coupon_type],amount:rightsText(item.rights_snapshot),
    expiry:'发放于 '+formatDateTime(item.issued_at),status:item.status==='AVAILABLE'?'可用':'已兑换',
    tone:item.status==='AVAILABLE'?'available':'muted',
    description:item.coupon_type==='PUBLISH_ONCE'?'可兑换一次发布额度。':'已发放的权益保存在券内，可查看来源与明细。'};
}
