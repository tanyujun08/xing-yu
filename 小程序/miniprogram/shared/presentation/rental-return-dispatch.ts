import type { ReviewOrder, ReviewReturn } from '../model/rental-return-review';
import { beijingTime, rentalActionAllowed } from './rental-order';
import { rentalDeliveryAddress, rentalDeliveryTerm, rentalFreight } from './rental-order-delivery';

export function returnAddressSnapshot(record: Pick<ReviewReturn, 'order_id' | 'return_id' | 'address_version' | 'address'> | null | undefined) {
    const a = record?.address;
    return record && a && [a.recipient_name, a.phone, a.region_text, a.detail].every(value => value?.trim()) && /^[1-9][0-9]*$/.test(record.address_version)
        ? JSON.stringify([record.order_id, record.return_id, record.address_version, a.source_id, a.recipient_name, a.country_code, a.phone, a.region_ids, a.region_text, a.detail]) : '';
}

export function rentalReturnDispatch(value: ReviewOrder, record: ReviewReturn | null, now = Date.now(), showDuringTerm = false) {
    const o = value.order;
    if (o.stage !== 'ACTIVE' || o.has_exception || o.review_status === 'FINAL' || !['TENANT', 'LESSOR'].includes(o.viewer_role)
        || record && (record.order_id !== o.order_id || record.return_id !== value.return_id || record.method !== value.delivery.method || record.received_at)
        || value.return_id && !record) return null;
    const personal = o.supply_channel === 'PERSONAL' && value.delivery.method === 'EXPRESS';
    const official = o.supply_channel === 'OFFICIAL_CABINET' && value.delivery.method === 'CABINET';
    const transit = personal && o.physical_status === 'RETURN_IN_TRANSIT' && !!record;
    const overdue = Number.isFinite(Date.parse(o.rental_end_at)) && now >= Date.parse(o.rental_end_at);
    const pending = o.viewer_role === 'TENANT' && ['IN_USE', 'RETURN_PENDING'].includes(o.physical_status)
        && (o.physical_status === 'RETURN_PENDING' || overdue || personal && showDuringTerm);
    if (!transit && !(pending && personal || pending && official && overdue)) return null;
    const address = record?.address ? rentalDeliveryAddress(record.address) : null;
    const addressKnown = !!address && !!returnAddressSnapshot(record);
    const code = transit ? o.viewer_role === 'LESSOR' ? 'E6' : 'F2' : official ? 'F1e' : addressKnown ? 'F1b' : 'F1c';
    const canReturn = o.viewer_role === 'TENANT' && [...o.allowed_actions, ...(record?.allowed_actions ?? [])]
        .some(action => action.allowed && ['START_RETURN', 'SAVE_RETURN_EVIDENCE', 'SHIP_RETURN'].includes(action.action_code));
    return {
        code, personal, official, transit, overdue, address: addressKnown ? address : null,
        lessor: o.viewer_role === 'LESSOR', term: rentalDeliveryTerm(o.rental_start_at, o.rental_end_at), deadline: beijingTime(o.rental_end_at),
        title: code === 'E6' ? '设备寄回中' : code === 'F2' ? '归还运输中' : code === 'F1c' ? '归还地址待完善' : code === 'F1e' ? '请尽快归还' : overdue ? '请尽快寄回' : '请按指引寄回',
        note: code === 'E6' ? '承租人已登记寄回信息，请在实际收到设备后确认。' : code === 'F2' ? '已登记寄回信息，请等待实际收回。寄出不等于归还完成。'
            : code === 'F1c' ? '本单尚无可用的归还收件地址，请联系客服协助；地址补齐后再办理寄回。' : code === 'F1e' ? '归还截止 ' + beijingTime(o.rental_end_at) + ' 已过，请按指引归还至租赁柜。' : '归还截止 ' + beijingTime(o.rental_end_at),
        supply: personal ? '个人设备' : '官方设备', returnFreight: rentalFreight(value.requirements.return_freight_payer, '寄回'),
        shipped: beijingTime(record?.shipped_at), carrier: record?.carrier ?? '未填写', tracking: record?.tracking_no ?? '',
        evidenceSaved: !!record?.submitted_at && Number.isFinite(Date.parse(record.submitted_at)) && record.material_status === 'COMPLETE',
        accessories: (value.asset_snapshot?.accessories ?? []).map(item => item.name + ' × ' + item.quantity).join('、'),
        canReturn: canReturn && code !== 'F1c',
        canCorrect: code === 'F2' && rentalActionAllowed(record?.allowed_actions ?? [], 'CORRECT_RETURN_SHIPMENT'),
        canReceive: code === 'E6' && rentalActionAllowed(record?.allowed_actions ?? [], 'CONFIRM_RECEIPT'),
        primaryLabel: code === 'E6' ? '我已收到，去确认' : code === 'F2' ? '查看归还进度' : code === 'F1c' ? '刷新地址' : '办理归还',
    };
}
