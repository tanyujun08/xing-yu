import type { OwnCoupon } from '../model/api-coupon';
import { formatDateTime } from '../format/date-time';
import { couponTitles, rightsText } from './loyalty';
const couponUsage:Record<OwnCoupon['coupon_type'],string[]>={
  DEPOSIT_WAIVER:['租设备时在确认下单页选择使用','使用后本单免交押金'],
  PUBLISH_ONCE:['点击下方按钮兑换为 1 次发布额度','兑换后发布设备时自动使用'],
  ONE_DAY_RENT:['租设备时在确认下单页选择使用','可抵扣 1 天租金'],
  GUARD_DISCOUNT:['购买设备保障服务时选择使用','按券面额抵扣保障费用']};
export function presentOwnCoupon(item: OwnCoupon) {
  if (item.rights_snapshot.kind!==item.coupon_type) throw new Error('券权益快照类型不一致。');
  return {id:item.coupon_id,title:couponTitles[item.coupon_type],amount:rightsText(item.rights_snapshot),
    expiry:'发放于 '+formatDateTime(item.issued_at),status:item.status==='AVAILABLE'?'可用':'已兑换',
    tone:item.status==='AVAILABLE'?'available':'muted',
    description:item.coupon_type==='PUBLISH_ONCE'?'可兑换一次发布额度。':'已发放的权益保存在券内，可查看来源与明细。',
    usage:couponUsage[item.coupon_type].map((text,i)=>({id:item.coupon_type+'-'+i,text})),useInOrder:item.status==='AVAILABLE'&&item.coupon_type!=='PUBLISH_ONCE'};
}
