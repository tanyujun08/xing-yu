export type CouponWalletFilter = 'available' | 'reserved' | 'used' | 'unavailable';

export interface CouponWalletItem {
  id: string;
  type: 'rental' | 'insurance' | 'guard' | 'express';
  coverage?: 'full_service';
  amountFen: number;
  expiresAt: string;
  state: 'available' | 'reserved' | 'redeemed' | 'released';
  orderId?: string | null;
}

/** Project stored facts without releasing, redeeming or expiring an asset. */
export function couponWalletFilter(item: CouponWalletItem, now = Date.now()): CouponWalletFilter {
  if (item.state === 'reserved') return 'reserved';
  if (item.state === 'redeemed') return 'used';
  if (item.state !== 'available') return 'unavailable';
  const expiresAt = Date.parse(item.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt >= now
    && Number.isSafeInteger(item.amountFen) && item.amountFen > 0
    && (item.type === 'rental' || item.type === 'insurance' || item.type === 'guard')
    ? 'available' : 'unavailable';
}
