import type {
  ContractPurchaseAllowedAction,
  ContractPurchaseOrder,
  ContractPurchaseOrderProjection,
  OrderBlockingReason,
  OrderProjectionBadge,

WechatPayMockOperation,
  WechatPayMockOperationFacts,
  WechatPayMockStatus,
} from '../services/contracts';

const UNRESOLVED_PROVIDER_STATUSES = new Set<WechatPayMockStatus>([
  'PROCESSING',
  'CONFIRMING',
  'UNKNOWN',
]);

function operationRequestNo(orderId: string, operation: WechatPayMockOperation): string {
  const prefix = `M${operation.slice(0, 3)}-`.toUpperCase();
  const normalized = orderId.replace(/[^A-Z0-9_\-|*]/gi, '-').toUpperCase();
  const available = 32 - prefix.length;
  const compact = normalized.length <= available
    ? normalized
    : `${normalized.slice(0, available - 9)}-${normalized.slice(-8)}`;
  return `${prefix}${compact}`.padEnd(6, '0').slice(0, 32);
}

export function createWechatPayMockFacts(input: {
  orderId: string;
  operation: WechatPayMockOperation;
  amountFen: number;
  status: WechatPayMockStatus;
  occurredAt: string;
  resultSource?: WechatPayMockOperationFacts['resultSource'];
  providerStatus?: string;
  transactionId?: string | null;
  outRefundNo?: string | null;
  refundId?: string | null;
  notificationReceived?: boolean;
  errorCode?: string | null;
  timeExpire?: string | null;
}): WechatPayMockOperationFacts {
  const merchantRequestNo = operationRequestNo(input.orderId, input.operation);
  const notificationReceived = input.notificationReceived ?? input.status === 'SUCCEEDED';
  const isRefund = input.operation === 'REFUND' || input.operation === 'DEPOSIT_RETURN';
  const carriesOriginalPaymentIdentity = input.operation === 'PAYMENT' || isRefund;
  return {
    provider: 'WECHAT_PAY_MOCK',
    operation: input.operation,
    merchantRequestNo,
    outTradeNo: operationRequestNo(input.orderId, 'PAYMENT'),
    transactionId: input.transactionId ?? (
      carriesOriginalPaymentIdentity && input.status === 'SUCCEEDED' ? `WXTX-${input.orderId}` : null
    ),
    outRefundNo: input.outRefundNo ?? (isRefund ? merchantRequestNo : null),
    refundId: input.refundId ?? (
      isRefund && input.status === 'SUCCEEDED' ? `WXRF-${input.operation}-${input.orderId}` : null
    ),
    amountFen: input.amountFen,
    currency: 'CNY',
    status: input.status,
    providerStatus: input.providerStatus ?? input.status,
    resultSource: input.resultSource ?? (notificationReceived ? 'NOTIFICATION' : 'CREATED'),
    notificationStatus: notificationReceived ? 'RECEIVED' : 'NOT_RECEIVED',
    notificationId: notificationReceived ? `WXNOTICE-${input.operation}-${input.orderId}` : null,
    notificationDedupeKey: notificationReceived ? `WXDEDUPE-${input.operation}-${input.orderId}` : null,
    notificationReceivedAt: notificationReceived ? input.occurredAt : null,
    idempotencyKey: `MOCK:${input.operation}:${input.orderId}`,
    lastQueriedAt: null,
    timeExpire: input.timeExpire ?? (
      input.operation === 'PAYMENT' && input.status === 'PENDING'
        ? new Date(Date.parse(input.occurredAt) + 30 * 60 * 1_000).toISOString()
        : null
    ),
    errorCode: input.errorCode ?? null,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
}

function contractProjectionStatus(order: ContractPurchaseOrder): ContractPurchaseOrderProjection['projectionStatus'] {
  if (
    order.lifecycleStatus === 'EXCEPTION'
    || order.payment.status === 'FAILED'
    || order.entitlement.status === 'FAILED'
    || order.refund?.status === 'FAILED'
  ) return 'EXCEPTION';
  if (order.refund?.status === 'SUCCEEDED' && order.entitlement.status !== 'REVERSED') return 'EXCEPTION';
  if (
    order.refund !== null
    && ['PENDING', 'PROCESSING', 'CONFIRMING', 'UNKNOWN'].includes(order.refund.status)
    && order.entitlement.status !== 'FROZEN'
  ) return 'EXCEPTION';
  if (order.entitlement.status === 'FROZEN' && (
    order.refund === null || !['PENDING', 'PROCESSING', 'CONFIRMING', 'UNKNOWN'].includes(order.refund.status)
  )) return 'EXCEPTION';
  if (order.entitlement.status === 'REVERSED' && order.refund?.status !== 'SUCCEEDED') return 'EXCEPTION';
  if (UNRESOLVED_PROVIDER_STATUSES.has(order.payment.status)) return 'PAYMENT_CONFIRMING';
  if (order.refund?.status === 'SUCCEEDED' && order.entitlement.status === 'REVERSED') return 'REFUNDED';
  if (
    order.refund !== null
    && ['PENDING', 'PROCESSING', 'CONFIRMING', 'UNKNOWN'].includes(order.refund.status)
  ) return 'REFUNDING';
  if (order.lifecycleStatus === 'CLOSED') {
    return order.payment.status === 'CLOSED' && order.refund === null && order.entitlement.status === 'NOT_GRANTED'
      ? 'CLOSED'
      : 'EXCEPTION';
  }
  if (['PENDING', 'NOT_STARTED'].includes(order.payment.status)) return 'PENDING_PAYMENT';
  if (order.payment.status === 'SUCCEEDED' && ['NOT_GRANTED', 'GRANT_PENDING'].includes(order.entitlement.status)) return 'ENTITLEMENT_PENDING';
  if (order.lifecycleStatus === 'COMPLETED' && order.entitlement.status === 'GRANTED') return 'COMPLETED';
  return 'EXCEPTION';
}

function contractActions(order: ContractPurchaseOrder): ContractPurchaseAllowedAction[] {
  const actions: ContractPurchaseAllowedAction[] = [
    { code: 'VIEW_DETAIL', label: '查看详情', permission: 'order.view', kind: 'NAVIGATION' },
  ];
  if (UNRESOLVED_PROVIDER_STATUSES.has(order.payment.status)) {
    actions.push({ code: 'QUERY_PAYMENT', label: '查询原支付单', permission: 'finance.manage', kind: 'COMMAND' });
  }
  if (order.refund !== null && UNRESOLVED_PROVIDER_STATUSES.has(order.refund.status)) {
    actions.push({ code: 'QUERY_REFUND', label: '查询原退款单', permission: 'finance.manage', kind: 'COMMAND' });
  }
  return actions;
}

export function projectContractPurchaseOrder(order: ContractPurchaseOrder): ContractPurchaseOrderProjection {
  const projectionStatus = contractProjectionStatus(order);
  const blockingReasons: OrderBlockingReason[] = [];
  if (order.payment.status !== 'SUCCEEDED' && projectionStatus !== 'CLOSED') blockingReasons.push({ code: 'PAYMENT_NOT_CONVERGED', message: '支付结果尚未成功收敛', axis: 'PAYMENT' });
  if (projectionStatus === 'ENTITLEMENT_PENDING') blockingReasons.push({ code: 'ENTITLEMENT_NOT_GRANTED', message: '支付与权益到账为独立轴，权益尚未到账', axis: 'ENTITLEMENT' });
  if (projectionStatus === 'REFUNDING') blockingReasons.push({ code: 'REFUND_NOT_CONVERGED', message: '退款原单结果尚未收敛', axis: 'REFUND' });
  const badgeLabels: Record<ContractPurchaseOrderProjection['projectionStatus'], string> = {
    PENDING_PAYMENT: '待支付',
    PAYMENT_CONFIRMING: '支付确认中',
    ENTITLEMENT_PENDING: '权益待到账',
    COMPLETED: '已完成',
    REFUNDING: '退款中',
    REFUNDED: '已退款',
    CLOSED: '已关闭',
    EXCEPTION: '异常',
  };
  const tone: OrderProjectionBadge['tone'] = projectionStatus === 'COMPLETED' || projectionStatus === 'REFUNDED'
    ? 'success'
    : projectionStatus === 'EXCEPTION'
      ? 'danger'
      : projectionStatus === 'CLOSED'
        ? 'default'
        : 'warning';
  return {
    ...order,
    projectionStatus,
    currentNode: badgeLabels[projectionStatus],
    badges: [{ code: projectionStatus, label: badgeLabels[projectionStatus], tone }],
    allowedActions: contractActions(order),
    blockingReasons,
  };
}
