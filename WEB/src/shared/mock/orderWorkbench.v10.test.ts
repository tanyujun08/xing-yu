import { describe, expect, test, vi } from 'vitest';
import type { MockState } from './schema';
import { DEFAULT_DEMO_STORAGE_KEY, assertMockInvariants } from './schema';
import { createMemoryDemoStorage } from './persistence';
import { createDemoRuntime } from './runtime';
import { createSeedState } from './seed';
import {  projectContractPurchaseOrder } from './orderProjections';

const FINANCE_ACTOR = 'mock-finance-001';

describe('Admin contract purchase workbench schema v10', () => {
  test('covers all contract purchase tabs with current-rule integer-fen snapshots and safe WeChat facts', () => {
    const state = createSeedState();
    const runtime = createDemoRuntime({ storage: createMemoryDemoStorage() });
    const projections = runtime.listContractPurchaseOrders();
    const currentRules = [...state.businessRuleVersions].sort((left, right) => right.version - left.version)[0]!;

    expect(new Set(projections.map((order) => order.projectionStatus))).toEqual(new Set([
      'PENDING_PAYMENT', 'PAYMENT_CONFIRMING', 'ENTITLEMENT_PENDING', 'COMPLETED',
      'REFUNDING', 'REFUNDED', 'CLOSED', 'EXCEPTION',
    ]));
    for (const order of state.contractPurchaseOrders) {
      expect(order.priceSnapshot.unitPriceFen).toBe(currentRules.contractUnitPriceFen);
      expect(order.priceSnapshot.totalAmountFen).toBe(order.priceSnapshot.unitPriceFen * order.subject.quantity);
      expect(Number.isSafeInteger(order.priceSnapshot.totalAmountFen)).toBe(true);
      expect(order.payment).toMatchObject({ provider: 'WECHAT_PAY_MOCK', currency: 'CNY' });
      expect(order.payment.outTradeNo).toMatch(/^[0-9A-Za-z_\-|*]{6,32}$/);
      expect(JSON.stringify(order.payment)).not.toMatch(/openid|secret|token|signature|callback/i);
      if (order.payment.status === 'PENDING') expect(Number.isNaN(Date.parse(order.payment.timeExpire ?? ''))).toBe(false);
    }
    const dirtyClosedPayment = structuredClone(state.contractPurchaseOrders.find((order) => order.id === 'cp_payment_unknown')!);
    dirtyClosedPayment.lifecycleStatus = 'CLOSED';
    expect(projectContractPurchaseOrder(dirtyClosedPayment).projectionStatus).toBe('PAYMENT_CONFIRMING');
    const dirtyClosedRefund = structuredClone(state.contractPurchaseOrders.find((order) => order.id === 'cp_refunding')!);
    dirtyClosedRefund.lifecycleStatus = 'CLOSED';
    expect(projectContractPurchaseOrder(dirtyClosedRefund).projectionStatus).toBe('REFUNDING');
  });

  test('exposes immutable purchase GRANT/FREEZE/REVERSE ledger histories', () => {
    const runtime = createDemoRuntime({ storage: createMemoryDemoStorage() });
    const completed = runtime.listContractCreditLedger('cp_completed');
    const refunding = runtime.listContractCreditLedger('cp_refunding');
    const refunded = runtime.listContractCreditLedger('cp_refunded');

    expect(new Set(completed.map((entry) => entry.type))).toEqual(new Set(['GRANT']));

expect(refunding.map((entry) => entry.type)).toContain('FREEZE');
    expect(refunded.map((entry) => entry.type)).toContain('REVERSE');
    expect(runtime.listContractPurchaseAuditTrail('cp_completed')[0]).toMatchObject({ aggregateId: 'cp_completed' });
  });

  test('queries original contract payment/refund once, rechecks permissions on replay, and never uses the network', () => {
    const runtime = createDemoRuntime({ storage: createMemoryDemoStorage() });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const payment = runtime.listContractPurchaseOrders().find((order) => order.id === 'cp_payment_unknown')!;
    const beforeGrantCount = runtime.listContractCreditLedger('cp_payment_unknown').length;
    const query = { orderId: payment.id, expectedVersion: payment.version, idempotencyKey: 'query:cp-payment-unknown', actorId: FINANCE_ACTOR };

    const resolved = runtime.queryContractPurchasePayment(query);
    expect(resolved).toMatchObject({ projectionStatus: 'COMPLETED', payment: { status: 'SUCCEEDED', resultSource: 'QUERY' }, entitlement: { status: 'GRANTED' } });
    expect(runtime.listContractCreditLedger(payment.id).length).toBe(beforeGrantCount + 1);
    expect(runtime.queryContractPurchasePayment(query)).toEqual(resolved);
    expect(runtime.listContractCreditLedger(payment.id).length).toBe(beforeGrantCount + 1);
    expect(() => runtime.queryContractPurchasePayment({ ...query, expectedVersion: query.expectedVersion + 1 })).toThrowError();
    expect(() => runtime.queryContractPurchasePayment({ ...query, actorId: 'mock-operations-001' })).toThrowError();
    expect(() => runtime.queryContractPurchasePayment({ ...query, actorId: 'mock-operator' })).toThrowError();
    expect(() => runtime.queryContractPurchasePayment({ ...query, actorId: 'system-seed' })).toThrowError();
    expect(() => runtime.queryContractPurchasePayment({ ...query, actorId: undefined } as never)).toThrowError();

    const refunding = runtime.listContractPurchaseOrders().find((order) => order.id === 'cp_refunding')!;
    const refunded = runtime.queryContractPurchaseRefund({
      orderId: refunding.id,
      expectedVersion: refunding.version,
      idempotencyKey: 'query:cp-refunding',
      actorId: FINANCE_ACTOR,
    });
    expect(refunded).toMatchObject({ projectionStatus: 'REFUNDED', refund: { status: 'SUCCEEDED', resultSource: 'QUERY' }, entitlement: { status: 'REVERSED' } });
    const closedStorage = createMemoryDemoStorage();
    closedStorage.setItem(DEFAULT_DEMO_STORAGE_KEY, JSON.stringify(createSeedState()));
    const closedRuntime = createDemoRuntime({
      storage: closedStorage,
      providerQueryResults: { 'PAYMENT:cp_payment_unknown': 'CLOSED' },
    });
    const closedPayment = closedRuntime.listContractPurchaseOrders().find((order) => order.id === 'cp_payment_unknown')!;
    const closedSnapshot = closedRuntime.getSnapshot();
    expect(() => closedRuntime.queryContractPurchasePayment({
      orderId: closedPayment.id,
      expectedVersion: closedPayment.version,
      idempotencyKey: 'query:cp-payment-closed-unsupported',
      actorId: FINANCE_ACTOR,
    })).toThrowError(/受控 Provider 枚举/);
    expect(closedRuntime.getSnapshot()).toEqual(closedSnapshot);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test('releases a full refund freeze on explicit failure without writing REVERSE', () => {
    const state = createSeedState();
    const refunding = state.contractPurchaseOrders.find((order) => order.id === 'cp_refunding')!;
    const storage = createMemoryDemoStorage();
    storage.setItem(DEFAULT_DEMO_STORAGE_KEY, JSON.stringify(state));
    const runtime = createDemoRuntime({
      storage,
      providerQueryResults: { 'REFUND:cp_refunding': 'REFUNDCLOSED' },
    });
    const result = runtime.queryContractPurchaseRefund({
      orderId: refunding.id,
      expectedVersion: refunding.version,
      idempotencyKey: 'query:cp-refund-failed',
      actorId: FINANCE_ACTOR,
    });
    expect(result).toMatchObject({
      projectionStatus: 'EXCEPTION',
      refund: { status: 'FAILED' },
      entitlement: { status: 'GRANTED', frozenCount: 0, reversedCount: 0 },
    });
    const ledger = runtime.listContractCreditLedger(refunding.id);
    expect(ledger.filter((entry) => entry.type === 'RELEASE')).toHaveLength(1);
    expect(ledger.some((entry) => entry.type === 'REVERSE')).toBe(false);
  });

  test('rejects adversarial Provider identities and refund chains', () => {
    const mutateAndReject = (mutate: (state: MockState) => void) => {
      const state = createSeedState();
      mutate(state);
      expect(() => assertMockInvariants(state)).toThrowError();
    };

mutateAndReject((state) => {
      const purchase = state.contractPurchaseOrders.find((order) => order.id === 'cp_refunded')!;
      purchase.refund!.outTradeNo = 'MTR-OTHER01';
    });
    mutateAndReject((state) => {
      const purchase = state.contractPurchaseOrders.find((order) => order.id === 'cp_refunded')!;
      purchase.refund!.transactionId = 'WXTX-OTHER';
    });
    mutateAndReject((state) => {
      const first = state.contractPurchaseOrders.find((order) => order.id === 'cp_completed')!.payment;
      const second = state.contractPurchaseOrders.find((order) => order.id === 'cp_refunding')!.payment;
      second.transactionId = first.transactionId;
    });
    
    mutateAndReject((state) => {
      const purchase = state.contractPurchaseOrders.find((order) => order.id === 'cp_refunding')!;
      purchase.refund!.status = 'FAILED';
      purchase.refund!.providerStatus = 'REFUNDCLOSED';
      purchase.refund!.errorCode = 'MOCK_REFUND_CLOSED';
      purchase.lifecycleStatus = 'EXCEPTION';
      Object.assign(purchase.entitlement, {
        status: 'GRANTED',
        availableCount: purchase.entitlement.grantedCount,
        reservedCount: 0,
        consumedCount: 0,
        frozenCount: 0,
        reversedCount: 0,
      });
      state.contractCreditLedger = state.contractCreditLedger.filter(
        (entry) => entry.purchaseOrderId !== purchase.id || entry.type !== 'FREEZE',
      );
    });

});

  test('rejects unsafe audit-source and timestamp boundary values in WeChat payment mocks', () => {
    const mutateAndReject = (mutate: (state: MockState) => void) => {
      const state = createSeedState();
      mutate(state);
      expect(() => assertMockInvariants(state)).toThrowError();
    };
    mutateAndReject((state) => {
      state.contractPurchaseOrders.find((order) => order.id === 'cp_completed')!.payment.resultSource = 'CREATED';
    });
    mutateAndReject((state) => {
      state.contractPurchaseOrders.find((order) => order.id === 'cp_pending')!.payment.merchantRequestNo = 'openid_token';
    });
    mutateAndReject((state) => {
      const refund = state.contractPurchaseOrders.find((order) => order.id === 'cp_refunding')!.refund!;
      refund.status = 'PENDING';
      refund.providerStatus = 'NOTPAY';
    });
    mutateAndReject((state) => {
      const payment = state.contractPurchaseOrders.find((order) => order.id === 'cp_pending')!.payment;
      payment.timeExpire = '2020-01-01T00:00:00.000Z';
    });
    mutateAndReject((state) => {
      const payment = state.contractPurchaseOrders.find((order) => order.id === 'cp_pending')!.payment;
      payment.timeExpire = '2026-08-25 00:30:00Z';
    });
    mutateAndReject((state) => {
      const payment = state.contractPurchaseOrders.find((order) => order.id === 'cp_pending')!.payment;
      payment.timeExpire = '2027-02-30T00:00:00Z';
    });
    mutateAndReject((state) => {
      const payment = state.contractPurchaseOrders.find((order) => order.id === 'cp_pending')!.payment;
      payment.timeExpire = '2026-08-25T24:00:00Z';
    });
    mutateAndReject((state) => {
      const purchase = state.contractPurchaseOrders.find((order) => order.id === 'cp_completed')!;
      purchase.updatedAt = '2020-01-01T00:00:00.000Z';
    });
    mutateAndReject((state) => {
      const purchase = state.contractPurchaseOrders.find((order) => order.id === 'cp_completed')!;
      const grant = state.contractCreditLedger.find((entry) => entry.purchaseOrderId === purchase.id && entry.type === 'GRANT')!;
      grant.occurredAt = '2020-01-01T00:00:00.000Z';
    });
  });

  test('rejects corrupt provider facts, cross-axis drift, invalid amounts, and impossible purchase closure/refund chains', () => {
    const mutateAndReject = (mutate: (state: MockState) => void) => {
      const state = createSeedState();
      mutate(state);
      expect(() => assertMockInvariants(state)).toThrowError();
    };
    mutateAndReject((state) => {
      const purchase = state.contractPurchaseOrders.find((order) => order.id === 'cp_refunding')!;
      purchase.refund!.amountFen -= 1;
    });
    mutateAndReject((state) => {
      const purchase = state.contractPurchaseOrders.find((order) => order.id === 'cp_refunded')!;
      purchase.entitlement.status = 'GRANTED';
    });
    mutateAndReject((state) => {
      const grant = state.contractCreditLedger.find((entry) => entry.purchaseOrderId === 'cp_completed' && entry.type === 'GRANT')!;
      state.contractCreditLedger.push({ ...structuredClone(grant), id: 'duplicate_grant', idempotencyKey: 'duplicate:grant' });
    });
    
    mutateAndReject((state) => {
      const received = state.contractPurchaseOrders.find((order) => order.id === 'cp_completed')!.payment;
      const other = state.contractPurchaseOrders.find((order) => order.id === 'cp_refunding')!.payment;
      other.notificationDedupeKey = received.notificationDedupeKey;
    });

mutateAndReject((state) => {
      const payment = state.contractPurchaseOrders[0]!.payment;
      (payment as unknown as Record<string, unknown>).resultSource = 'CALLBACK_BODY';
    });
    mutateAndReject((state) => {
      const entry = state.contractCreditLedger[0]!;
      (entry as unknown as Record<string, unknown>).type = 'ADJUST';
    });

mutateAndReject((state) => {
      const purchase = state.contractPurchaseOrders.find((order) => order.id === 'cp_payment_unknown')!;
      purchase.lifecycleStatus = 'CLOSED';
    });
    mutateAndReject((state) => {
      const purchase = state.contractPurchaseOrders.find((order) => order.id === 'cp_pending')!;
      purchase.lifecycleStatus = 'COMPLETED';
    });
    mutateAndReject((state) => {
      const purchase = state.contractPurchaseOrders.find((order) => order.id === 'cp_refunded')!;
      purchase.lifecycleStatus = 'OPEN';
      purchase.closedAt = null;
    });
    mutateAndReject((state) => {
      const purchase = state.contractPurchaseOrders.find((order) => order.id === 'cp_refunding')!;
      purchase.refund!.status = 'PENDING';
      purchase.entitlement.status = 'GRANTED';
    });
    mutateAndReject((state) => {
      const purchase = state.contractPurchaseOrders.find((order) => order.id === 'cp_refunded')!;
      purchase.refund!.status = 'FAILED';
      purchase.refund!.errorCode = 'MOCK_REFUND_FAILED';
    });
    mutateAndReject((state) => {
      const purchase = state.contractPurchaseOrders.find((order) => order.id === 'cp_refunded')!;
      purchase.refund = null;
    });
    mutateAndReject((state) => {
      const purchase = state.contractPurchaseOrders.find((order) => order.id === 'cp_refunding')!;
      purchase.refund = null;
    });

mutateAndReject((state) => {
      const payment = state.contractPurchaseOrders.find((order) => order.payment.status === 'SUCCEEDED')!.payment;
      payment.transactionId = null;
    });
    mutateAndReject((state) => {
      const refund = state.contractPurchaseOrders.find((order) => order.refund?.status === 'SUCCEEDED')!.refund!;
      refund.refundId = null;
    });
    mutateAndReject((state) => {
      const payment = state.contractPurchaseOrders.find((order) => order.payment.status === 'FAILED')!.payment;
      payment.errorCode = null;
    });
    
  });
});
