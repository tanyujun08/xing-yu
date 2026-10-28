import { rentalCabinetTaskCopy } from './rental-order';

type Task = { purpose: string; status: string; order_id: string; door_status: string; occupancy_result: string; observed_at: string | null; blockers: readonly { message: string }[] };
export function cabinetFeedback(task?: Task, elapsed = 0, disconnected = false) {
    const done = task?.status === 'SUCCEEDED';
    const failed = task?.status === 'CANCELLED' || task?.status === 'FAILED_CONFIRMED';
    const opened = !done && !failed && task?.door_status === 'OPEN' && !!task.observed_at;
    const confirming = !done && !failed && task?.door_status === 'CLOSED' && task.occupancy_result === 'TARGET_ABSENT' && !!task.observed_at;
    const reserved = task?.status === 'RESERVED';
    const slow = !opened && !confirming && !done && !failed && !reserved && (elapsed >= 15_000 || task?.status === 'UNKNOWN' || disconnected);
    const phase = done ? 'done' : failed ? 'failed' : reserved ? 'reserved' : opened ? 'opened' : confirming ? 'confirming' : slow ? 'slow' : 'opening';
    const step = done ? 3 : opened || confirming ? 1 : 0;
    return {
        feedbackPhase: phase,
        feedbackTone: done ? 'success' : failed ? 'error' : slow ? 'warning' : 'pending',
        feedbackSymbol: done ? 'success' : failed || slow ? 'warning' : opened ? 'open' : 'cabinet',
        feedbackEyebrow: done || failed || slow || reserved ? '' : opened ? '柜门已打开' : '自动同步中',
        feedbackTitle: done ? '取件完成' : failed ? '本次取件未完成' : reserved ? '等待确认开柜' : opened ? '请取出设备并关门' : confirming ? '正在确认取件结果' : slow ? '暂未确认开门' : '正在开柜',
        feedbackContent: done ? '已确认设备取出，柜门已关好。' : failed ? rentalCabinetTaskCopy(task!) : reserved ? '尚未发送开柜指令，请输入本单取件码继续。' : opened ? '请取出设备并关好柜门。' : confirming ? '柜门已关闭，正在确认设备取出结果。' : slow ? '柜机响应较慢，正在继续核实，请勿重复开柜。' : '正在连接柜机，请稍候。',
        feedbackHint: done ? '租期和归还安排可在订单中查看' : failed || reserved ? '' : disconnected ? '网络恢复后会自动更新' : opened ? '关门后将自动确认取件结果' : confirming ? '结果会自动更新，无需刷新' : '系统会自动确认柜门状态',
        feedbackSteps: ['开柜', '取物', '完成'].map((label, index) => ({ label, state: index < step ? 'done' : index === step ? 'active' : 'waiting' })),
        feedbackPrimary: done ? '查看订单' : failed ? '知道了' : reserved ? '继续取件' : opened ? '知道了' : '收起提示',
        feedbackQuiet: !done && !failed && !opened && !reserved,
        feedbackContact: failed || slow,
        feedbackOrderId: task?.order_id ?? '',
    };
}
