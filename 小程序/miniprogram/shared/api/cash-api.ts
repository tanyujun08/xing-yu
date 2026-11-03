import { request } from './request';
import { newIdempotencyKey } from './idempotency';

export interface CashBalance { currency: string; available_fen: string; withdrawable_fen?: string; frozen_fen?: string }
export interface WithdrawalReceipt { withdrawal_id: string; amount_fen?: string; status?: string }

/** 现金余额与提现：钱包页的提现弹窗使用。 */
export const cashApi = {
  balance: () => request<CashBalance>({ path: '/v1/me/cash-balance' }),
  newIntent: () => newIdempotencyKey('withdrawal'),
  withdraw: (amountFen: number, intent: string) => request<WithdrawalReceipt, { amount_fen: string }>({ path: '/v1/me/withdrawals', method: 'POST', body: { amount_fen: String(amountFen) }, idempotencyKey: intent }),
};
