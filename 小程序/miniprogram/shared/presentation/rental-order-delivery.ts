import { beijingTime, rentalDateRange, rentalActionAllowed } from './rental-order';

type Action = { action_code: string; allowed: boolean; display_reason: string | null };
type Address = { recipient_name: string; country_code: string; phone: string; region_text: string; detail: string };
type Order = {
    order: { supply_channel: string; viewer_role: string; stage: string; physical_status: string; display_status_code: string;
        has_exception: boolean; rental_start_at: string; rental_end_at: string; allowed_actions: readonly Action[] };
    delivery: { method: string; recipient: Address | null; shipped_at: string | null; delivered_at: string | null; tracking_no: string | null; carrier: string | null };
    requirements: { outbound_freight_payer: string; return_freight_payer: string };
};

export function rentalDeliveryAddress(value: Address | null | undefined) {
    if (!value) return null;
    return { person: value.recipient_name, phone: [value.country_code, value.phone].filter(Boolean).join(' '), region: value.region_text, detail: value.detail };
}
export function rentalDeliveryAddressText(value: Address | null | undefined) {
    const address = rentalDeliveryAddress(value);
    return address ? [address.person, address.phone, address.region, address.detail].filter(Boolean).join(' ') : '';
}
export function personalDeliveryAction(value: Order, code: string) {
    const o = value.order;
    if (o.supply_channel !== 'PERSONAL' || value.delivery.method !== 'EXPRESS' || o.stage !== 'ACTIVE' || o.has_exception || !rentalActionAllowed(o.allowed_actions, code)) return false;
    if (code === 'SHIP') return o.viewer_role === 'LESSOR' && o.physical_status === 'NOT_DELIVERED';
    if (code === 'CORRECT_SHIPMENT') return o.viewer_role === 'LESSOR' && o.physical_status === 'OUTBOUND';
    if (code === 'CONFIRM_DELIVERY') return o.viewer_role === 'TENANT' && o.physical_status === 'OUTBOUND';
    return false;
}
export function rentalDeliveryTerm(start: string, end: string) {
    const days = (Date.parse(end) - Date.parse(start)) / 86400000;
    return rentalDateRange(start, end) + (Number.isInteger(days) && days > 0 ? ' · 共' + days + '天' : '');
}
export function rentalFreight(payer: string | undefined, direction: '寄出' | '寄回') {
    const labels: Record<string, string> = { TENANT: '承租人承担', LESSOR: '出租方承担', PLATFORM: '平台承担', NOT_APPLICABLE: '不适用' };
    return direction + '运费' + (labels[payer ?? ''] ?? '待核实');
}
export function rentalOrderDelivery(value: Order) {
    const o = value.order, d = value.delivery;
    if (o.supply_channel !== 'PERSONAL' || d.method !== 'EXPRESS' || o.stage !== 'ACTIVE' || o.has_exception || !['TENANT', 'LESSOR'].includes(o.viewer_role)) return null;
    const tenant = o.viewer_role === 'TENANT';
    const kind = o.physical_status === 'NOT_DELIVERED' ? 'waiting' : o.physical_status === 'OUTBOUND' ? 'outbound'
        : o.physical_status === 'IN_USE' && d.delivered_at && Number.isFinite(Date.parse(d.delivered_at)) && o.display_status_code === 'IN_USE' ? 'using' : '';
    if (!kind) return null;
    const title = kind === 'waiting' ? tenant ? '等待出租方发货' : '等待发货' : kind === 'outbound' ? tenant ? '出租方已发货' : '已发货，等待承租人收货' : tenant ? '租赁中' : '租赁进行中';
    const copy = kind === 'waiting' ? tenant ? '出租方将尽快安排发货，请耐心等待。' : '请按本单收货地址寄出设备。'
        : kind === 'outbound' ? tenant ? '设备已寄出，请耐心等待收货。' : '包裹已寄出，请耐心等待承租人确认收货。' : tenant ? '请合理安排寄回时间。' : '承租人已确认收货。';
    return { kind, tenant, title, copy, term: rentalDeliveryTerm(o.rental_start_at, o.rental_end_at), deadline: beijingTime(o.rental_end_at),
        recipient: rentalDeliveryAddress(d.recipient), shipped: beijingTime(d.shipped_at), delivered: beijingTime(d.delivered_at),
        tracking: d.tracking_no ?? '', carrier: d.carrier ?? '未填写', outboundFreight: rentalFreight(value.requirements?.outbound_freight_payer, '寄出'), returnFreight: rentalFreight(value.requirements?.return_freight_payer, '寄回'),
        canShip: personalDeliveryAction(value, 'SHIP'), canCorrect: personalDeliveryAction(value, 'CORRECT_SHIPMENT'), canReceive: personalDeliveryAction(value, 'CONFIRM_DELIVERY'),
        returnAction: tenant && kind === 'using' ? o.allowed_actions.find(a => a.allowed && ['SAVE_RETURN_EVIDENCE', 'START_RETURN'].includes(a.action_code))?.action_code ?? '' : '',
    };
}
