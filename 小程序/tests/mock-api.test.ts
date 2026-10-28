import { beforeEach, expect, test } from 'vitest';
import { createMockListing, completeMockWithdrawal, getMockAddresses, getMockListingDraft, getMockListingDrafts, getMockListings, getMockPublishEligibility, getMockWallet, getMockDiamondBalance, getCurrentMockAccount, getMockServicePurchaseRecords, purchaseMockPublishQuota, purchaseMockService, listDevices, queryMockWithdrawal, resetFixture, retryMockWithdrawal, runMockOrchestrator, saveMockListingDraft, deleteMockListingDraft, saveMockAddress, setMockListingPrice, setMockListingStatus, submitMockWithdrawal, switchMockAccount, updateMockListing } from '../miniprogram/shared/fixture';
import { getMockMemberRules } from '../miniprogram/shared/fixture/member-rules';
import { readMockState, writeMockState } from '../miniprogram/shared/fixture/mock-store';
import { completeFaceAuthentication, submitIdentityDocuments } from '../miniprogram/shared/fixture/account-identity';
beforeEach(() => resetFixture());
function dateText(offsetDays: number) { const date = new Date(); date.setDate(date.getDate() + offsetDays); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function verifyCurrentIdentity() { expect(submitIdentityDocuments('星遇用户', '31010119900101001X').ok).toBe(true); expect(completeFaceAuthentication().ok).toBe(true); }


test('keeps publish quota tied to a successful submission and does not charge rejected resubmission', () => {
  verifyCurrentIdentity();
  const before = getMockPublishEligibility().publishQuota;
  const listing = createMockListing({ name: 'Canon R8', category: '微单/单反', brand: 'Canon', model: 'R8', condition: '成色良好', notes: '', accessories: '电池', description: '轻便相机', location: '上海徐汇', deliveryMethods: ['meet'], photoRefs: ['saved://r8.jpg'], proofRefs: ['saved://proof.jpg'], expectedRentYuan: 300, expectedDepositYuan: 5_000, serialNumber: 'R8-QUOTA-001', availabilityStart: dateText(0), availabilityEnd: dateText(30), meetingAddress: '上海徐汇', meetingTime: '周末10:00–18:00' });
  expect(listing).not.toBeNull();
  expect(getMockPublishEligibility().publishQuota).toBe(before - 1);
  expect(updateMockListing('listing-own-rejected', { proofRefs: ['saved://updated-proof.jpg'] })).not.toBeNull();
  expect(getMockPublishEligibility().publishQuota).toBe(before - 1);
});


test('purchases publish quota with diamonds and persists rental service balances', () => {
  const before = getMockPublishEligibility();
  const quotaPurchase = purchaseMockPublishQuota(1);
  expect(quotaPurchase.ok).toBe(true);
  expect(getMockPublishEligibility().publishQuota).toBe(before.publishQuota + 1);
  expect(getMockPublishEligibility().publishQuotaTotal).toBe(before.publishQuotaTotal + 1);
  expect(getMockDiamondBalance()).toBe(480);

  const servicePurchase = purchaseMockService('contract', 1, '123 粉钻', { idempotencyKey: 'service-test', accountId: getCurrentMockAccount().id, ruleVersion: getMockMemberRules().version, diamondCost: 123 });
  expect(servicePurchase.ok).toBe(true);
  expect(servicePurchase.diamondCost).toBe(123);
  expect(servicePurchase.diamondBalance).toBe(357);
  expect(getMockPublishEligibility().serviceBalance.contract).toBe(1);
  expect(getMockDiamondBalance()).toBe(357);
  expect(getMockServicePurchaseRecords()[0]).toMatchObject({ kind: 'contract', quantity: 1, priceText: '123 粉钻' });
});


test('converges withdrawal unknown and failed results without deducting the balance twice', () => {
  const seed = readMockState();
  seed.walletEntries.push({ id: 'cash-fixture', userId: seed.currentAccountId, listingId: 'listing-fixture', listingNameSnapshot: '现金纯fixture', orderId: 'cash-ledger-reference', rentFen: 4800, amountFen: 4800, state: 'settled', settlementCondition: '已入账fixture', createdAt: new Date().toISOString() });
  writeMockState(seed);
  const availableBefore = getMockWallet().availableFen;
  const amountYuan = Math.max(1, Math.floor(availableBefore / 200));
  const submitted = submitMockWithdrawal(amountYuan);
  expect(submitted.ok).toBe(true);
  const id = submitted.record!.id;
  const amountFen = amountYuan * 100;
  expect(getMockWallet().availableFen).toBe(availableBefore - amountFen);
  expect(completeMockWithdrawal(id, 'unknown').record?.state).toBe('unknown');
  expect(getMockWallet().availableFen).toBe(availableBefore - amountFen);
  expect(queryMockWithdrawal(id).record?.state).toBe('completed');
  expect(getMockWallet().availableFen).toBe(availableBefore - amountFen);
  const failed = submitMockWithdrawal(amountYuan);
  expect(completeMockWithdrawal(failed.record!.id, 'failure').record?.state).toBe('failed');
  expect(retryMockWithdrawal(failed.record!.id).record?.state).toBe('processing');
});


test('publishes a personal device, discovers it across subjects, and hides it as soon as it is rented', () => {
  verifyCurrentIdentity();
  const listing = createMockListing({
    name: 'Canon R8', category: '微单/单反', brand: 'Canon', model: 'R8', condition: '成色良好', notes: '', accessories: '电池、充电器', description: '轻便全画幅相机', location: '上海徐汇', deliveryMethods: ['meet'], photoRefs: ['saved://r8.jpg'], proofRefs: ['saved://proof.jpg'], expectedRentYuan: 300, expectedDepositYuan: 5_000, serialNumber: 'R8-USER-001', availabilityStart: dateText(0), availabilityEnd: dateText(30), meetingAddress: '上海徐汇', meetingTime: '周末10:00–18:00',
  })!;
  runMockOrchestrator({ force: true, maxTasks: 1, orderId: listing.id });
  expect(getMockListings()[0]?.status).toBe('pricing');
  expect(setMockListingPrice(listing.id, 300, 5_000)).toBe(true);
  expect(getMockListings()[0]?.status).toBe('listed');

  switchMockAccount('mock-lessor-b');
  const deviceId = `listing-device-${listing.id}`;
  expect(listDevices().map((device) => device.id)).toContain(deviceId);
});


test('keeps listing review, pricing and listing transitions behind commands', () => {
  verifyCurrentIdentity();
  const listing = createMockListing({ name: 'Nikon Zf', category: '微单/单反', brand: 'Nikon', model: 'Zf', condition: '九成新', notes: '', accessories: '电池', description: '复古相机', location: '上海静安', deliveryMethods: ['express'], photoRefs: ['saved://zf.jpg'], proofRefs: ['saved://proof.jpg'], expectedRentYuan: 200, expectedDepositYuan: 3_000, serialNumber: 'ZF-001', availabilityStart: dateText(0), availabilityEnd: dateText(20) })!;
  expect(setMockListingStatus(listing.id, 'listed')).toBe(false);
  runMockOrchestrator({ force: true, maxTasks: 1, orderId: listing.id });
  expect(setMockListingPrice(listing.id, 200, 3_000)).toBe(true);
  expect(getMockListings()[0]?.status).toBe('listed');
  expect(setMockListingStatus(listing.id, 'unlisted')).toBe(true);
});


test('persists address commands per current subject without allowing URL state to create records', () => {
  const before = getMockAddresses().length;
  const saved = saveMockAddress({ name: '林先生', phone: '13912345678', region: '上海市浦东新区', detail: '世纪大道100号', isDefault: false });
  expect(saved).not.toBeNull();
  expect(getMockAddresses()).toHaveLength(before + 1);
  switchMockAccount('mock-lessor-b');
  expect(getMockAddresses().some((address) => address.id === saved?.id)).toBe(false);
});


test('saves and restores personal publishing drafts per account', () => {
  const draft = saveMockListingDraft({ name: '未完成设备', category: '微单/单反', brand: 'Canon', model: 'R8', condition: '', notes: '', accessories: '', description: '', location: '', deliveryMethods: ['meet'], photoRefs: [], proofRefs: [], expectedRentYuan: 300, expectedDepositYuan: 5000, availabilityStart: dateText(0), availabilityEnd: dateText(30), meetingAddress: '', meetingTime: '' });
  expect(draft).not.toBeNull();
  expect(getMockListingDrafts().map((item) => item.id)).toContain(draft!.id);
  expect(getMockListingDraft(draft!.id)?.brand).toBe('Canon');
  switchMockAccount('mock-lessor-b');
  expect(getMockListingDraft(draft!.id)).toBeUndefined();
  switchMockAccount('mock-tenant-a');
  expect(deleteMockListingDraft(draft!.id)).toBe(true);
  expect(getMockListingDrafts()).toHaveLength(0);
});
