import type { ReviewOrder, ReviewReturn, ReviewEarning } from '../model/rental-return-review';
import { beijingTime } from './rental-order';
import { rentalDeliveryTerm } from './rental-order-delivery';

const timeKnown = (value: string | null | undefined): value is string => !!value && Number.isFinite(Date.parse(value));
export function originalPostedEarning(order: ReviewOrder, earning: ReviewEarning) {
    return order.order.viewer_role === 'LESSOR' && order.order.supply_channel === 'PERSONAL' && order.order.stage === 'COMPLETED'
        && !!order.earning_id && earning.earning_id === order.earning_id && earning.order_id === order.order.order_id
        && earning.beneficiary_kind === 'PERSONAL' && earning.currency === 'CNY' && timeKnown(earning.posted_at);
}

/** The return read is mandatory: a display label or local clock cannot prove receipt. */
export function rentalReturnReview(order: ReviewOrder, record: ReviewReturn | null, earning: ReviewEarning | null = null) {
    const o = order.order, assessment = order.bill.assessment;
    if (!['ACTIVE', 'COMPLETED'].includes(o.stage) || o.physical_status !== 'RECEIVED' || !record || record.order_id !== o.order_id
        || record.return_id !== order.return_id || !timeKnown(record.received_at) || !['CABINET', 'LESSOR', 'OFFICIAL'].includes(record.receipt_source ?? '')) return null;
    const lessor = o.viewer_role === 'LESSOR' && o.supply_channel === 'PERSONAL';
    if (!lessor && o.viewer_role !== 'TENANT' || !lessor && (o.stage === 'COMPLETED' || o.review_status === 'FINAL')) return null;
    const complete = o.stage === 'COMPLETED', final = o.review_status === 'FINAL' && order.bill.finalized;
    const disputed = o.review_status === 'DISPUTED' || assessment?.decision === 'REVIEW_PENDING';
    const materialRequired = o.review_status === 'MATERIAL_REQUIRED' || !disputed && record.material_status === 'INCOMPLETE';
    const submitted = timeKnown(record.submitted_at) && record.material_status === 'COMPLETE';
    const code = lessor ? complete ? 'E4' : 'E8' : materialRequired ? 'F3' : disputed ? 'F5' : 'F4';
    const booked = !!earning && originalPostedEarning(order, earning);
    const missing = (record.missing_items ?? []).map(item => {
        const slot = record.evidence_slots.find(v => v.slot.slot_key === item.slot_key);
        return { key: item.slot_key + ':' + item.item_no, title: slot?.slot.title ?? '归还凭证', reason: item.reason, stage: slot?.slot.stage ?? '', editable: !!slot?.editable };
    });
    if (materialRequired && !missing.length) for (const entry of record.evidence_slots.filter(v => !v.complete)) {
        missing.push({ key: entry.slot.slot_key + ':1', title: entry.slot.title, reason: entry.slot.instruction, stage: entry.slot.stage, editable: entry.editable });
    }
    const title = complete ? '订单已完成' : lessor ? '设备已收回' : code === 'F3' ? '设备已收回，请补充材料' : code === 'F5' ? '费用待核实' : '归还审核中';
    const progress = materialRequired ? '等待承租人补充材料' : disputed ? '官方正在核实费用依据' : final ? '费用已核定，等待资金处理完成' : '正在等待官方审核';
    const updates = [assessment?.created_at, record.receipt_recorded_at, record.submitted_at, ...(record.evidence_history ?? []).map(item => item.created_at)].filter(timeKnown);
    const latestUpdate = updates.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
    const reviewTime = timeKnown(assessment?.created_at) ? beijingTime(assessment.created_at) : '';
    const reason = disputed ? assessment?.rejection_reason?.trim() || assessment?.adjustment_reason?.trim() || '官方正在核实归还材料及费用依据，请稍后刷新处理进度。' : '';
    return {
        code, lessor, complete, booked, title, materialRequired, disputed, final, missing, reason,
        note: complete ? '感谢你的支持，本次租赁服务已完成。' : lessor ? progress : code === 'F3' ? '请按下方要求补交材料，已提交的材料会保留。' : '费用以官方核定结果为准；实收后不继续累计逾期。',
        received: beijingTime(record.received_at), term: rentalDeliveryTerm(o.rental_start_at, o.rental_end_at), supply: o.supply_channel === 'PERSONAL' ? '个人设备' : '官方设备',
        earningNote: booked ? '本单收益已记入租赁收益，可查看结算明细。' : '本单收益入账记录尚未核实，请刷新进度。',
        canSupplement: code === 'F3' && missing.some(item => item.editable),
        primaryLabel: code === 'F3' ? '补交材料' : code === 'F4' ? '刷新审核进度' : code === 'F5' ? '联系客服' : complete ? '查看结算明细' : '刷新进度',
        steps: [
            { key: 'received', label: '设备已收回', detail: beijingTime(record.received_at), done: true, current: false },
            { key: 'materials', label: final ? '材料审核完成' : materialRequired ? lessor ? '等待承租人补充材料' : '待补充材料' : submitted ? '材料已提交' : '材料提交状态待核实', detail: submitted ? beijingTime(record.submitted_at) : '', done: final || submitted && !materialRequired, current: materialRequired && !final },
            { key: 'review', label: final ? '费用已核定' : disputed ? '费用待核实' : '官方审核中', detail: final || disputed ? reviewTime : latestUpdate ? '最近更新：' + beijingTime(latestUpdate) : '', done: final, current: !final && !materialRequired },
            ...(lessor ? [{ key: 'settled', label: complete ? booked ? '款项已结清' : '收益入账待核实' : final ? '资金处理中' : '等待结算', detail: booked ? beijingTime(earning!.posted_at) : '', done: booked, current: final && !booked }] : []),
        ],
    };
}
