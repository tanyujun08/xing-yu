type FrozenPayment = { payment_mode: string; business_amount_fen: string; channel_amount_fen: string; amount_fen: string };

export function validPaymentAmounts(value: FrozenPayment, business: string | undefined) {
    if (!business || !/^[1-9][0-9]*$/.test(business) || value.business_amount_fen !== business || value.channel_amount_fen !== value.amount_fen) return false;
    return value.payment_mode === 'NORMAL' ? value.amount_fen === business
        : value.payment_mode === 'FIXED_10_FEN' && value.amount_fen === '10';
}
export const testPaymentNote = '测试支付：业务价格不变，每笔渠道支付0.10元；业务押金覆盖不代表实际收款，测试订单不生成收益。';
