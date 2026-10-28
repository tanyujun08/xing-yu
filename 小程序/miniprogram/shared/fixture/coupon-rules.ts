/** Local Mock configuration. The eventual API supplies this projection; pages do not own prices. */
export interface MockCouponProduct {
  id: string;
  type: 'rental' | 'insurance' | 'guard' | 'express';
  title: string;
  amountFen: number;
  cost: number;
  monthlyLimit: number;
  expiresAt: string;
  enabled: boolean;
  coverage?: 'full_service';
  supplyScope?: 'general' | 'cabinet';
  applyAt?: 'checkout' | 'final_hourly_settlement';
  eligibleRentalModes?: Array<'hourly' | 'daily'>;
  applyAtByRentalMode?: Partial<Record<'hourly' | 'daily', 'checkout' | 'final_hourly_settlement'>>;
}

export interface MockCouponRules {
  version: string;
  guardFeeFen: number;
  products: MockCouponProduct[];
}

export function getMockCouponRules(): MockCouponRules {
  const expiresAt = '2027-12-31T23:59:59+08:00';
  return {
    version: 'coupon-rules-20260910-1',
    guardFeeFen: 4_000,
    products: [
      { id: 'rental-10', type: 'rental', title: '10 元通用租赁优惠券', amountFen: 1_000, cost: 1_000, monthlyLimit: 10, expiresAt, enabled: true, supplyScope: 'general', applyAt: 'checkout', eligibleRentalModes: ['hourly', 'daily'], applyAtByRentalMode: { hourly: 'checkout', daily: 'checkout' } },
      { id: 'rental-20', type: 'rental', title: '20 元通用租赁优惠券', amountFen: 2_000, cost: 2_000, monthlyLimit: 10, expiresAt, enabled: true, supplyScope: 'general', applyAt: 'checkout', eligibleRentalModes: ['hourly', 'daily'], applyAtByRentalMode: { hourly: 'checkout', daily: 'checkout' } },
      { id: 'cabinet-rental-10', type: 'rental', title: '10 元柜机租赁优惠券', amountFen: 1_000, cost: 1_000, monthlyLimit: 10, expiresAt, enabled: true, supplyScope: 'cabinet', eligibleRentalModes: ['hourly', 'daily'], applyAtByRentalMode: { hourly: 'final_hourly_settlement', daily: 'checkout' } },
      { id: 'service-after-sale', type: 'guard', title: '售后守护券', amountFen: 4_000, cost: 200, monthlyLimit: 10, expiresAt, enabled: true, coverage: 'full_service' },
      { id: 'service-insurance', type: 'insurance', title: '安心保优惠券', amountFen: 4_500, cost: 200, monthlyLimit: 10, expiresAt, enabled: true },
      { id: 'express-10', type: 'express', title: '10 元快递抵用券', amountFen: 1_000, cost: 1_000, monthlyLimit: 10, expiresAt, enabled: false },
    ],
  };
}
