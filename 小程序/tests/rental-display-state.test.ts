import { expect, test } from 'vitest';
import { rentalStateLabel } from '../miniprogram/shared/presentation/rental-order';

test.each([
    ['PREPARING', '准备签约'], ['AWAITING_CONFIRMATION', '待确认'], ['AWAITING_PAYMENT', '待支付'],
    ['AWAITING_DELIVERY', '待交付'], ['IN_USE', '使用中'],
    ['RETURNING', '归还中'], ['RETURN_REVIEW', '归还审核中'],
    ['AWAITING_SUPPLEMENT', '待补缴'], ['REFUND_PROCESSING', '退押处理中'],
    ['SETTLEMENT_CONFIRMING', '结算确认中'], ['COMPLETED', '已完成'], ['CLOSED', '已关闭'],
])('server display state %s has a readable conversation and order label', (code, label) => {
    expect(rentalStateLabel(code)).toBe(label);
});
test.each(['UNKNOWN', 'FUTURE_STATE', ''])('unrecognized state %s stays unverified', code => {
    expect(rentalStateLabel(code)).toBe('待核实');
});
