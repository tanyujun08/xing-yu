import type { components } from '../../shared/services/rentalOrders';

type Schema = components['schemas'];
// Keep each field's meaning distinct; these labels never replace API values.
export const rentalLabels = {
  physical: { NOT_DELIVERED: '未交付', OUTBOUND: '发货在途', IN_USE: '使用中', RETURN_PENDING: '待归还', RETURN_IN_TRANSIT: '寄回在途', RETURN_VERIFICATION: '归还核实中', RECEIVED: '已收回' } satisfies Record<Schema['Physical'], string>,
  review: { NOT_STARTED: '未审核', PENDING: '待审核', MATERIAL_REQUIRED: '待补材料', DISPUTED: '待核实', FINAL: '已核定' } satisfies Record<Schema['ReviewStatus'], string>,
  payment: { CREATED: '支付已创建', PROCESSING: '支付处理中', UNKNOWN: '支付结果待确认', SUCCEEDED: '支付成功', FAILED_CONFIRMED: '支付失败', CLOSED_UNPAID: '未支付关闭' } satisfies Record<Schema['PaymentStatus'], string>,
  refund: { CREATED: '退款已创建', PROCESSING: '退款处理中', UNKNOWN: '退款结果待确认', SUCCEEDED: '退款成功', FAILED_CONFIRMED: '退款失败' } satisfies Record<Schema['RefundStatus'], string>,
  purpose: { INITIAL: '初始付款', SUPPLEMENT: '补缴', DEPOSIT: '退押', ADMIN_UNPICKED: '管理员未取件退款', OBSERVED_NONFULFILLMENT: '无法履约退款观察', EXCESS_PAYMENT: '重复收款退款' } satisfies Record<Schema['PaymentView']['purpose'] | Schema['RefundView']['purpose'], string>,
  purchasePayment: { UNPAID: '未支付', PROCESSING: '支付处理中', UNKNOWN: '支付结果待确认', PAID: '已支付', CLOSED: '已关闭' } satisfies Record<Schema['OpsEntitlementPurchaseListItem']['consideration_status'], string>,
  purchaseGrant: { NOT_GRANTED: '未发放', GRANTED: '已发放', REVOKED: '已撤回' } satisfies Record<Schema['OpsEntitlementPurchaseListItem']['grant_status'], string>,
  purchaseKind: { CONTRACT: '合同次数', PUBLISH_QUOTA: '发布次数', PACKAGE: '组合套餐' } satisfies Record<Schema['OpsEntitlementPurchaseListItem']['kind'], string>,
  entitlementAction: { GRANT: '发放', RESERVE: '预占', CONSUME: '消费', RELEASE: '释放', REVERSE: '冲回', RESTORE: '恢复', EXPIRE: '过期', REVOKE: '撤回' } satisfies Record<string, string>,
  contract: { PENDING: '待同意', SUCCEEDED: '已完成同意', EXPIRED: '同意已过期' } satisfies Record<Schema['ContractView']['status'], string>,
  quota: { NOT_APPLICABLE: '不适用', RESERVED: '已预占', CONSUMED: '已消耗', RELEASED: '已释放', RESTORED: '已恢复' } satisfies Record<Schema['ContractView']['quota_state'], string>,
  signerRole: { TENANT: '承租人', LESSOR: '出租方', PLATFORM: '平台' } satisfies Record<Schema['Signer']['role'], string>,
  signerStatus: { PENDING: '待同意', SUCCEEDED: '已同意' } satisfies Record<Schema['Signer']['status'], string>,
  material: { INCOMPLETE: '材料未齐', COMPLETE: '材料完整' } satisfies Record<Schema['OpsReturnView']['material_status'], string>,
  receiptSource: { CABINET: '租赁柜', LESSOR: '出租方', OFFICIAL: '官方人员' } satisfies Record<NonNullable<Schema['OpsReturnView']['receipt_source']>, string>,
  decision: { REVIEW_PENDING: '待核实', MATERIAL_REQUIRED: '要求补材料', APPROVE_FINAL: '最终核定' } satisfies Record<Schema['OpsReviewView']['decision'], string>,
  cabinetStatus: { RESERVED: '已预留', EXECUTING: '执行中', UNKNOWN: '结果待确认', VERIFYING: '核实中', AWAITING_CONFIRMATION: '等待用户确认', ANOMALY: '归还失败，待客服处理', SUCCEEDED: '已成功', CANCELLED: '已取消', FAILED_CONFIRMED: '已确认失败' } satisfies Record<Schema['CabinetTask']['status'], string>,
  door: { OPEN: '门已打开', CLOSED: '门已关闭', UNKNOWN: '门态未知' } satisfies Record<Schema['CabinetTask']['door_status'], string>,
  rfid: { MATCH: '匹配', MISMATCH: '不匹配', NOT_OBSERVED: '未观测' } satisfies Record<Schema['CabinetTask']['rfid_result'], string>,
  occupancy: { TARGET_PRESENT: '本单设备在格', TARGET_ABSENT: '本单设备已离格', OTHER_ASSET: '其他设备占用', UNKNOWN: '占用待确认' } satisfies Record<Schema['CabinetTask']['occupancy_result'], string>,
};
export function rentalLabel(labels: Readonly<Record<string, string>>, value: string | null | undefined): string {
  return value == null ? '—' : Object.hasOwn(labels, value) ? labels[value]! : `未知状态（${value}）`;
}

export function rentalExceptionLabel(code: string, blockers: readonly Schema['Blocker'][]): string {
  const message = blockers.find((blocker) => blocker.code === code && blocker.message.trim())?.message.trim();
  if (message) return message;
  return code === 'PAYMENT_VERIFICATION_REQUIRED' ? '支付结果待核实' : `订单异常待核实（${code}）`;
}
