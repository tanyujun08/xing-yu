import { formatCNYMinorUnits } from '../format/money';
/** Rendering gate only; settlement commands remain server-authoritative. */
export function rentalDepositSettlementVisible(value: {
    order: { stage: string; physical_status: string; review_status: string };
    fees: { initial_due_fen: string };
    bill: { finalized: boolean; initial_payment: { purpose: string; status: string } | null };
}): boolean {
    if (!['ACTIVE', 'COMPLETED'].includes(value.order.stage) || value.order.physical_status !== 'RECEIVED' || value.order.review_status !== 'FINAL' || !value.bill.finalized) return false;
    return value.fees.initial_due_fen === '0' || value.bill.initial_payment?.status === 'SUCCEEDED';
}
export function rentalMoney(value: string | null | undefined): string { return value == null ? '待核实' : formatCNYMinorUnits(value); }
export function beijingTime(value: string | null | undefined): string {
    if (!value)
        return '—';
    const ms = Date.parse(value);
    if (!Number.isFinite(ms))
        return '—';
    const d = new Date(ms + 8 * 60 * 60 * 1000), pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
export function beijingInputToUTC(date: string, time: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
        throw new Error('请选择完整的日期和时间');
    const value = new Date(date + 'T' + time + ':00+08:00');
    if (!Number.isFinite(value.getTime()) || beijingTime(value.toISOString()) !== date + ' ' + time)
        throw new Error('日期无效');
    return value.toISOString();
}
export function rentalDate(value: string | null | undefined): string { return beijingTime(value).split(' ')[0]!; }
export function rentalDateRange(start: string, end: string): string { return rentalDate(start) + ' 至 ' + rentalDate(end); }
export const rentalActionLabels: Record<string, string> = {
    CONFIRM_ORDER: '确认订单', PAY_INITIAL: '支付订单', PAY_SUPPLEMENT: '支付补缴', INVOKE_PAYMENT: '继续支付', QUERY_PAYMENT: '查询支付结果', QUERY_REFUND: '查询退押结果', CANCEL_UNPAID: '取消未支付订单', VIEW_CONTRACT: '查看租赁协议', SIGN_CONTRACT: '签署租赁合同', SHIP: '填写快递单号', CORRECT_SHIPMENT: '更正快递单号', CONFIRM_DELIVERY: '确认收货', START_RETURN: '办理归还', SET_RETURN_ADDRESS: '设置返程收货地址', SHIP_RETURN: '填写返程单号', CORRECT_RETURN_SHIPMENT: '更正返程单号', SAVE_RETURN_EVIDENCE: '查看 / 补充归还凭证', CONFIRM_RETURN: '确认归还', CONFIRM_RECEIPT: '确认实际收回', SELECT_COMPARTMENT: '选择归还格口', OPEN_CABINET: '确认开柜', CANCEL_CABINET: '取消未开柜任务', QUERY_CABINET: '查询柜机结果', READ_PICKUP_CODE: '查看取件码', CONTACT_OFFICIAL: '联系客服',
};
type Action = {
    action_code: string;
    allowed: boolean;
    display_reason: string | null;
};
export function rentalActions(actions: readonly Action[]) {
    // Presentation priority only: availability and execution remain server-authoritative.
    const priority = ['SIGN_CONTRACT', 'CONFIRM_ORDER', 'PAY_INITIAL', 'PAY_SUPPLEMENT', 'INVOKE_PAYMENT', 'SHIP', 'CONFIRM_DELIVERY', 'READ_PICKUP_CODE', 'SAVE_RETURN_EVIDENCE', 'SHIP_RETURN', 'CONFIRM_RECEIPT', 'SELECT_COMPARTMENT', 'OPEN_CABINET', 'START_RETURN', 'QUERY_PAYMENT', 'QUERY_REFUND', 'QUERY_CABINET'];
    const primary = priority.find(code => actions.some(a => a.action_code === code && a.allowed));
    return actions.filter(a => a.action_code !== 'CONTACT_OFFICIAL').map(a => ({ ...a, label: rentalActionLabels[a.action_code] ?? a.action_code, primary: a.allowed && a.action_code === primary }));
}
export function rentalActionAllowed(actions: readonly Action[], code: string) { return actions.some(a => a.action_code === code && a.allowed); }
export function rentalBlockers(blockers: readonly {
    message: string;
}[]) { return blockers.map(item => item.message).join('；'); }
export function rentalCabinetTaskLabel(status: string): string {
    const labels: Record<string, string> = { RESERVED: '等待开柜', EXECUTING: '柜机处理中', AWAITING_CONFIRMATION: '请确认归还', ANOMALY: '归还失败，请联系客服', UNKNOWN: '结果待核实', VERIFYING: '正在核验', SUCCEEDED: '已完成', CANCELLED: '未开柜任务已取消', FAILED_CONFIRMED: '本次操作未完成' };
    return labels[status] ?? '待核实';
}
export function rentalCabinetTaskCopy(task: { purpose: string; status: string; blockers: readonly { message: string }[]; door_status?: string; occupancy_result?: string }): string {
    if (task.purpose === 'RETURN' && task.status === 'ANOMALY') return rentalBlockers(task.blockers) || '柜内设备标签核验未通过，本次归还尚未完成。请联系客服处理。';
    if (task.purpose === 'RETURN' && task.status === 'AWAITING_CONFIRMATION') return '请放入设备和全部配件，拍摄入柜照片并关好柜门，再点击确认归还。';
    if (task.purpose === 'RETURN' && task.status === 'VERIFYING') return '正在查询原格口的门态与设备标签，请等待核验结果。';
    if (task.purpose === 'PICKUP' && ['EXECUTING', 'VERIFYING', 'UNKNOWN'].includes(task.status) && task.door_status === 'OPEN' && task.occupancy_result === 'TARGET_PRESENT')
        return '柜门已打开，请取出设备并关好柜门，取件结果将自动更新。';
    const blocker = rentalBlockers(task.blockers);
    if (blocker) return blocker;
    const purpose = task.purpose === 'PICKUP' ? '取件' : '归还';
    if (task.status === 'CANCELLED') return `本次${purpose}任务已取消。请返回订单查看后续安排，如需帮助请联系客服。`;
    if (task.status === 'FAILED_CONFIRMED') return `本次${purpose}未完成。请返回订单查看处理情况，或联系客服。`;
    if (task.status === 'SUCCEEDED') return task.purpose === 'PICKUP'
        ? '柜机已确认取件完成，请按订单租期使用并归还设备。'
        : '柜机已确认归还设备，退押仍需官方审核。';
    if (task.status === 'RESERVED') return task.purpose === 'PICKUP' ? '尚未发送开柜指令。请返回柜详情输入取件码继续，或重新扫描本单租赁柜的小程序码。' : '尚未发送开柜指令，请返回原格口预留核对并确认开柜。';
    return task.purpose === 'PICKUP' ? '正在自动核实柜机状态；门开或请求受理不代表已经完成。请取出设备并关门，结果将自动更新。' : '门开或请求受理不代表已经完成；请取放设备并关门，再查询原任务。';
}
export function rentalOrderCard(order: {
    order_id: string;
    order_no: string;
    display_status: string;
    display_status_code: string;
    has_exception: boolean;
    created_at: string;
    rental_start_at: string;
    rental_end_at: string;
    supply_channel: string;
    initial_due_fen: string;
    initial_paid_fen: string | null;
    initial_payer_total_fen: string | null;
    supplement_due_fen: string | null;
    payment_due_at: string | null;
    viewer_role: string;
    allowed_actions: readonly Action[];
    asset: {
        title: string;
        cover_media: {
            access_url?: string;
            url?: string;
        } | null;
    };
}) {
    const supplement = order.display_status_code === 'AWAITING_SUPPLEMENT';
    const paid = order.initial_paid_fen !== null;
    const can = (code: string) => rentalActionAllowed(order.allowed_actions, code);
    const lessor = order.viewer_role === 'LESSOR';
    const lessorTask = can('SHIP') ? '填写运单' : ['RETURNING', 'RETURN_REVIEW'].includes(order.display_status_code) ? '查看归还' : ['AWAITING_SUPPLEMENT', 'REFUND_PROCESSING', 'SETTLEMENT_CONFIRMING', 'COMPLETED'].includes(order.display_status_code) ? '查看结算' : '查看订单';
    const actionLabel = lessor ? lessorTask : supplement ? '查看费用' : can('SIGN_CONTRACT') ? '继续签约' : can('PAY_INITIAL') ? '去支付' : can('SHIP') ? '填写运单' : can('READ_PICKUP_CODE') ? '查看取件码' : can('START_RETURN') || can('SAVE_RETURN_EVIDENCE') ? '去归还' : '查看订单';
    return { id: order.order_id, orderNo: order.order_no, deviceName: order.asset.title,
        createdText: beijingTime(order.created_at), mainStatusText: order.display_status, currentNodeText: order.display_status,
        statusTone: order.has_exception || order.display_status_code === 'AWAITING_PAYMENT' ? 'warning' : order.display_status_code === 'COMPLETED' || order.display_status_code === 'PREPARING' ? 'success' : 'muted',
        rentalText: rentalDateRange(order.rental_start_at, order.rental_end_at),
        pickupText: order.supply_channel === 'PERSONAL' ? '快递往返' : '租赁柜取还',
        supplyText: order.supply_channel === 'PERSONAL' ? '个人设备' : '官方设备',
        showAmount: !lessor,
        amountLabel: lessor ? '' : supplement ? '待补缴金额' : paid ? '实付金额' : '应付金额',
        amountText: lessor ? '' : supplement ? rentalMoney(order.supplement_due_fen) : paid ? rentalMoney(order.initial_payer_total_fen) : rentalMoney(order.initial_due_fen),
        deadlineText: !lessor && order.display_status_code === 'AWAITING_PAYMENT' && order.payment_due_at ? '请在 ' + beijingTime(order.payment_due_at) + ' 前完成支付' : '',
        actionLabel, actionPrimary: ['继续签约', '去支付', '填写运单', '去归还'].includes(actionLabel), destination: actionLabel === '继续签约' ? 'contract' as const : 'detail' as const,
        image: order.asset.cover_media?.url ?? order.asset.cover_media?.access_url ?? '', mediaState: order.asset.cover_media ? 'ready' : 'idle' };
}
export function rentalStateLabel(code: string): string {
    const displayLabels: Record<string, string> = { AWAITING_CONFIRMATION: '待确认', AWAITING_DELIVERY: '待交付', RETURN_REVIEW: '归还审核中', AWAITING_SUPPLEMENT: '待补缴', REFUND_PROCESSING: '退押处理中', SETTLEMENT_CONFIRMING: '结算确认中' };
    if (displayLabels[code]) return displayLabels[code];
    const labels: Record<string, string> = { PREPARING: '准备签约', AWAITING_PAYMENT: '待支付', ACTIVE: '履约中', COMPLETED: '已完成', CLOSED: '已关闭', NONE: '未开始', NOT_DELIVERED: '尚未交付', OUTBOUND: '已寄出', RETURN_PENDING: '待归还', RETURN_IN_TRANSIT: '归还在途', DELIVERED: '已交付', OUTBOUND_SHIPPED: '已寄出', IN_USE: '使用中', RETURNING: '归还中', RETURN_SHIPPED: '已寄回', RETURN_VERIFICATION: '柜机核验中', RECEIVED: '实物已收回', PENDING: '待审核', APPROVED: '已通过', REJECTED: '未通过', NEED_MORE: '待补充材料', REQUIRED: '待提交材料', INCOMPLETE: '材料待补充', COMPLETE: '材料齐全', NOT_REQUIRED: '无需处理', NOT_STARTED: '未开始审核', MATERIAL_REQUIRED: '待补充材料', DISPUTED: '争议处理中', FINAL: '审核已定案', VERIFYING: '材料待复核' };
    return labels[code] ?? '待核实';
}


