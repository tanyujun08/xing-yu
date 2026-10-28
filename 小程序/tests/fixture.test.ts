import { beforeEach, describe, expect, test } from 'vitest';
import { depositOptions, diamondFenForPoints, diamondPointsForFen, requireNonNegativeSafeInteger, getDevice, listDevices, listDevicesBySupply, listCabinets, parseDateTimeMs, resetFixture } from '../miniprogram/shared/fixture';
import { calculateDailyRent, calculateDepositQuote, calculateHourlyBilling, distributeLiability, evaluateClose } from '../miniprogram/shared/fixture/lifecycle-rules';
beforeEach(() => resetFixture());


test('binds exactly one rental mode to every device and exposes only approved deposit plans', () => {
  const catalog = listDevices();
  expect(catalog.every((device) => device.rentalMode === 'hourly' || device.rentalMode === 'daily')).toBe(true);
  expect(catalog.find((device) => device.id === 'sony-a7c')?.rentalMode).toBe('hourly');
  expect(catalog.find((device) => device.id === 'sony-a7c-personal')?.rentalMode).toBe('daily');
  expect(new Set(catalog.map((device) => device.spuId)).size).toBeGreaterThanOrEqual(5);
  expect(new Set(catalog.map((device) => device.skuId)).size).toBeGreaterThanOrEqual(6);
  expect(catalog.every((device) => device.spuId && device.skuId && device.stock! > 0 && device.assetIds.length > 0 && device.depositPlans!.length > 0)).toBe(true);
  expect(depositOptions.map((option) => option.id)).toEqual(['cash', 'wechat', 'full']);
});


test('seeds four cabinets with ten distinct orderable device models each', () => {
  const cabinets = listCabinets();
  expect(cabinets).toHaveLength(4);
  expect(listDevicesBySupply('cabinet')).toHaveLength(40);
  for (const cabinet of cabinets) {
    expect(cabinet.deviceIds).toHaveLength(10);
    expect(new Set(cabinet.deviceIds).size).toBe(10);
    const devices = cabinet.deviceIds.map((id) => getDevice(id));
    expect(devices.every((device) => device.supplyType === 'cabinet' && device.deliveries.includes('cabinet') && device.allowRenewal === false)).toBe(true);
    expect(new Set(devices.map((device) => device.model)).size).toBe(10);
  }
});


test('rounds hourly rent up to whole hours and caps the whole order at its frozen product value', () => {
  const input = { startedAtMs: 0, hourlyRateFen: 2_000, referenceValueFen: 1_300_000 };
  expect(calculateHourlyBilling({ ...input, effectiveReturnAtMs: 20 * 60_000 })).toMatchObject({ billedHours: 1, rentFen: 2_000 });
  expect(calculateHourlyBilling({ ...input, effectiveReturnAtMs: 50 * 60_000 })).toMatchObject({ billedHours: 1, rentFen: 2_000 });
  expect(calculateHourlyBilling({ ...input, effectiveReturnAtMs: 24 * 60 * 60_000 + 20 * 60_000 })).toMatchObject({ billedHours: 25, rentFen: 50_000 });
  expect(calculateHourlyBilling({ ...input, effectiveReturnAtMs: 900 * 60 * 60_000 })).toMatchObject({ billedHours: 900, rentFen: 1_300_000 });
  expect(getDevice('sony-a7c').referenceValueFen).toBe(1_300_000);
});


test('parses non-zero-padded business timestamps without creating a multi-decade bill', () => {
  const parsed = parseDateTimeMs('2026-8-28 16:56:26');
  expect(Number.isFinite(parsed)).toBe(true);
  expect(Number.isFinite(parseDateTimeMs('2026-08-28 16:56:'))).toBe(true);
});


test('applies powder only to cash deposit and never to rent or liability', () => {
  const quote = calculateDepositQuote({ mode: 'daily', configuredDepositFen: 100_000, fullDepositSelected: false, diamondPointsReserved: 30_000, configuredDiamondPoints: 20_000, configuredDiamondWaiverFen: 20_000 });
  expect(quote.cashDepositFen).toBe(80_000);
  expect(quote.diamondWaiverFen).toBe(20_000);
  const rent = calculateDailyRent({ handoverAtMs: 0, effectiveReturnAtMs: 3.2 * 86_400_000, dailyRateFen: 10_000, plannedDays: 5, minimumDays: 1, allowEarlyReduction: true, cashRentPaidFen: 50_000, rentalVoucherFen: 5_000 });
  expect(rent.chargeableDays).toBe(4);
  expect(rent.finalCashRentFen).toBe(35_000);
  expect(distributeLiability({ actualLossFen: 90_000, insuranceEligibleFen: 90_000, insurancePaidFen: 20_000, cashDepositHeldFen: 50_000 })).toEqual({ confirmedLossFen: 90_000, insuranceAppliedFen: 20_000, depositDeductionFen: 50_000, supplementFen: 20_000, depositReturnFen: 0, lessorCompensationFen: 90_000 });
});


test('accepts only nonnegative safe-integer PINK values and truncates sub-fen waiver remainder', () => {
  const base = { mode: 'daily' as const, configuredDepositFen: 100, fullDepositSelected: false, configuredDiamondPoints: 3, configuredDiamondWaiverFen: 1 };
  expect(calculateDepositQuote({ ...base, diamondPointsReserved: 2 })).toMatchObject({ cashDepositFen: 100, diamondPointsApplied: 2, diamondWaiverFen: 0 });
  expect(diamondFenForPoints(100)).toBe(100);
  expect(diamondPointsForFen(100)).toBe(100);
  for (const invalid of [-1, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => calculateDepositQuote({ ...base, diamondPointsReserved: invalid })).toThrow(/非负安全整数/);
    expect(() => diamondFenForPoints(invalid)).toThrow(/非负安全整数/);
    expect(() => requireNonNegativeSafeInteger(invalid, '粉钻数量')).toThrow(/非负安全整数/);
  }
});


describe('strict close guard', () => {
  const closed = { physicalClosed: true, acceptanceClosed: true, dispute: 'resolved' as const, appeal: 'resolved' as const, payment: 'succeeded' as const, depositReturn: 'succeeded' as const, refund: 'not_applicable' as const, supplement: 'none' as const, settlement: 'not_applicable' as const, insuranceClaim: 'not_applicable' as const, externalConfirming: false };
  test('closes only after every independent axis has converged', () => {
    expect(evaluateClose(closed).closable).toBe(true);
    expect(evaluateClose({ ...closed, externalConfirming: true }).closable).toBe(false);
    expect(evaluateClose({ ...closed, payment: 'confirming' }).closable).toBe(false);
    expect(evaluateClose({ ...closed, appeal: 'open' }).closable).toBe(false);
    expect(evaluateClose({ ...closed, supplement: 'pending' }).closable).toBe(false);
  });
});
