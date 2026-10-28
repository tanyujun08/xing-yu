import { beforeEach, expect, test, vi } from 'vitest';
import { handleDemo, recordDemoPayment, readDemo, resetDemo, registerMaterial, advanceDemoReview } from '../miniprogram/preview/engine';
import { ACCOUNT } from '../miniprogram/preview/seed';
import { supplyApi, discoveryApi, publicationApi } from '../miniprogram/shared/api/supply-api';
import { rentalOrderApi, orderConversationApi } from '../miniprogram/shared/api/rental-api';
import { accountApi, addressApi, lotteryApi, couponApi, benefitApi } from '../miniprogram/shared/api/account-api';
import { assertLotteryState, assertLotteryAttempt, assertRedemptionAttempt } from '../miniprogram/shared/presentation/loyalty';
import { ownAssetsApi } from '../miniprogram/shared/api/own-assets-api';
import { installDemoPlatform } from '../miniprogram/preview/platform';
const storage = new Map<string, unknown>();
beforeEach(() => { storage.clear(); vi.stubGlobal('wx', { getStorageSync: (k: string) => storage.get(k) ?? '', setStorageSync: (k: string, v: unknown) => storage.set(k, structuredClone(v)), removeStorageSync: (k: string) => storage.delete(k), getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }), getFileSystemManager: () => ({ copyFile: vi.fn() }), chooseMedia: vi.fn(), env: { USER_DATA_PATH: 'wxfile://usr' } }); resetDemo(); readDemo().latency = 0; installDemoPlatform(); });
test('all original supply and discovery adapters validate local records with original media checks', async () => { const items = await supplyApi.list().promise; expect(items.items).toHaveLength(20); expect(new Set(items.items.map(v => v.asset_id)).size).toBe(20); expect((await supplyApi.get('asset-1').promise).asset_id).toBe('asset-1'); expect((await discoveryApi.listSupplies({ supply_type: 'PERSONAL' }).promise).items).toHaveLength(8); expect((await discoveryApi.getSupply('asset-2').promise).asset_id).toBe('asset-2'); expect((await discoveryApi.listStores().promise).items).toHaveLength(3); });
test('original publication validation accepts eligibility, pricing context and rich draft', async () => { expect((await publicationApi.eligibility().promise).eligible).toBe(true); expect((await publicationApi.publicationContext('product-1').promise).product_id).toBe('product-1'); expect((await publicationApi.draft('draft-demo').promise).asset.display_name).toContain('索尼'); expect((await ownAssetsApi.list().promise).items.length).toBeGreaterThan(8); });
test('all ten order states have a detail record and current ETag', async () => { const list = await rentalOrderApi.list({ role: 'TENANT' }).promise; expect(list.value.items).toHaveLength(10); expect(new Set(list.value.items.map(v => v.display_status_code)).size).toBe(10); for (const item of list.value.items) { const d = await rentalOrderApi.get(item.order_id).promise; expect(d.value.order.order_id).toBe(item.order_id); expect(d.etag).toMatch(/^"/); } });
test('local payment reconciliation advances the original order and replay does not duplicate', async () => { const original = await rentalOrderApi.get('order-2').promise, payment = await rentalOrderApi.createPayment('order-2', 'INITIAL', original.etag, null).promise; recordDemoPayment(payment.value.payment_id, 'SUCCESS'); await rentalOrderApi.queryPayment(payment.value.payment_id, payment.etag).promise; expect((await rentalOrderApi.get('order-2').promise).value.order.stage).toBe('ACTIVE'); const body = { asset_id: 'asset-1', rental_start_at: demoDateAfter(2), rental_end_at: demoDateAfter(4), delivery_method: 'CABINET', address_id: null, coupon_id: null, accepted_terms_hash: 'a'.repeat(64) }; body.accepted_terms_hash = handleDemo('POST', '/v1/me/rental-quotes', body).data.terms_hash; const h = { 'Idempotency-Key': 'stable-demo-idempotency' }; const a = handleDemo('POST', '/v1/me/rental-orders/preparations', body, h), b = handleDemo('POST', '/v1/me/rental-orders/preparations', body, h); expect(a.data.order.order_id).toBe(b.data.order.order_id); expect(readDemo().orders).toHaveLength(21); });
test('signature preview and confirm round trip is local and makes the order payable', async () => { const c = await rentalOrderApi.contract('order-1').promise; const body = { client_signature_id: 'demo-client-signature-123', signature_material_id: 'ink-demo', agreement_sha256: c.value.agreement_sha256, order_terms_sha256: c.value.order_terms_sha256, replaces_attempt_id: null, replaces_attempt_version: null }; registerMaterial('/assets/demo/device-1.png', 'CONTRACT_SIGNATURE_IMAGE', 'ink-demo'); const attempt = await rentalOrderApi.createSignature('order-1', body, c.etag).promise; expect(attempt.value.status).toBe('PREVIEW_READY'); const found = await rentalOrderApi.signature('order-1', body.client_signature_id).promise; expect(found.value.state).toBe('FOUND'); await rentalOrderApi.confirmSignature('order-1', body.client_signature_id, { preview_artifact_id: attempt.value.preview_artifact_id!, preview_sha256: attempt.value.preview_sha256!, accepted: true }, attempt.etag).promise; expect((await rentalOrderApi.contract('order-1').promise).value.status).toBe('SUCCEEDED'); const ready = await rentalOrderApi.get('order-1').promise; await rentalOrderApi.confirm('order-1', ready.etag).promise; expect((await rentalOrderApi.get('order-1').promise).value.order.stage).toBe('AWAITING_PAYMENT'); });
test('address mutations and profile changes can be read back without external transport', async () => { const a = await addressApi.list().promise; expect(a.items).toHaveLength(3); await accountApi.updateProfile({ display_name: '演示改名', avatar_material_id: 'avatar-demo', locale: 'zh-CN' }, 1, 'profile-local').promise; expect((await accountApi.profile().promise).display_name).toBe('演示改名'); });
test('message send and history preserve original actor and client-message identity', async () => { const chat = await orderConversationApi.ensure('order-4').promise; const intent = orderConversationApi.prepare(chat.conversation_id, { kind: 'TEXT', text: '你好，演示消息' }); const ack = await orderConversationApi.send(intent).promise; expect(ack.sender_id).toBe(ACCOUNT); expect(ack.body).toBe('你好，演示消息'); expect((await orderConversationApi.messages(chat.conversation_id).promise).items.length).toBe(4); });
test('lottery state and result satisfy original client assertion rules', async () => { const state = await lotteryApi.state().promise; assertLotteryState(state, ACCOUNT); const result = await lotteryApi.submit({ confirmed_cost_pink_units: '50', expected_coupon_config_version_id: state.coupon_config_version_id, expected_lottery_config_version_id: state.lottery_config_version_id! }, 'lottery-demo-test').promise; assertLotteryAttempt(result, ACCOUNT); expect(readDemo().pink).toBe(28850); });
test('coupon redemption is consistent with original result assertion and prevents repeated consumption', async () => { const coupon = await couponApi.detail('coupon-2').promise; expect(coupon.coupon_type).toBe('PUBLISH_ONCE'); const result = handleDemo('POST', '/v1/me/coupons/coupon-2/redemptions', { expected_coupon_version: coupon.version }, { 'Idempotency-Key': 'redeem-unique' }).data; assertRedemptionAttempt(result as never, ACCOUNT); expect(handleDemo('POST', '/v1/me/coupons/coupon-2/redemptions', { expected_coupon_version: coupon.version }, { 'Idempotency-Key': 'redeem-unique' }).data).toEqual(result); expect((await couponApi.detail('coupon-2').promise).status).toBe('REDEEMED'); });
test('benefits have balances; unsupported interfaces fail closed; empty/error scenarios are explicit', async () => { expect((await benefitApi.summary().promise).profile.available_pink_units).toBe('28800'); expect(() => handleDemo('POST', 'https://api.example.invalid/v1/unknown')).toThrow('尚未适配'); readDemo().scenario = 'empty'; expect(handleDemo('GET', '/v1/me/rental-orders').data.items).toEqual([]); readDemo().scenario = 'error'; expect(() => handleDemo('GET', '/v1/me/rental-orders')).toThrow('模拟读取失败'); });
test('a newly quoted order preserves its selected fees through confirm and payment', async () => {
 const body = { asset_id: 'asset-1', rental_start_at: demoDateAfter(2), rental_end_at: demoDateAfter(4), delivery_method: 'CABINET', address_id: null, coupon_id: null, accepted_terms_hash: 'a'.repeat(64) };
 const quote = handleDemo('POST', '/v1/me/rental-quotes', body).data;
 const created = handleDemo('POST', '/v1/me/rental-orders/preparations', { ...body, accepted_terms_hash: quote.terms_hash }).data;
 expect(created.fees).toEqual(quote.fees);
 const id = created.order.order_id;
 await signOrder(id); const confirmed = handleDemo('POST', '/v1/me/rental-orders/' + id + '/confirm').data;
 expect(confirmed.fees).toEqual(quote.fees);
 const payment = await rentalOrderApi.createPayment(id, 'INITIAL', (await rentalOrderApi.get(id).promise).etag, null).promise;
 expect(payment.value.amount_fen).toBe(quote.fees.initial_due_fen);
 recordDemoPayment(payment.value.payment_id, 'SUCCESS'); await rentalOrderApi.queryPayment(payment.value.payment_id, payment.etag).promise;
 const paid = (await rentalOrderApi.get(id).promise).value;
 expect(paid.fees).toEqual(quote.fees);
 expect(paid.bill.funds_summary.gross_received_fen).toBe(quote.fees.initial_due_fen);
 expect(paid.bill.funds_summary.net_received_fen).toBe(quote.fees.initial_due_fen);
});
test('return cabinet reserve/open/confirm stays bound to the original order and waits for confirmation', async () => {
 const order = await rentalOrderApi.get('order-4').promise;
 const draft = await rentalOrderApi.startReturn('order-4', 'CABINET', order.etag).promise;
 expect(draft.value.order_id).toBe('order-4');
 const current = await rentalOrderApi.get('order-4').promise;
 const task = await rentalOrderApi.reserveCabinet('order-4', 'cabinet-1', 'slot-1', current.etag).promise;
 const opened = await rentalOrderApi.openCabinet(task.value.task_id, null, task.etag).promise;
 expect(opened.value.status).toBe('AWAITING_CONFIRMATION');
 const done = await rentalOrderApi.confirmCabinetReturn(task.value.task_id, opened.etag).promise;
 expect(done.value.status).toBe('SUCCEEDED');
 expect((await rentalOrderApi.get('order-4').promise).value.order.display_status_code).toBe('RETURN_REVIEW');
 advanceDemoReview();
 const reviewing = (await rentalOrderApi.get('order-4').promise).value;
 expect(reviewing.order.display_status_code).toBe('REFUND_PROCESSING');
 expect(reviewing.bill.refund_summary.latest_refund?.order_id).toBe('order-4');
});
test('publication draft submission and explicit demo review create a discoverable owned asset', async () => {
 const receipt = await publicationApi.submitDraft('draft-demo', '1', 'publish-original-demo').promise;
 expect(receipt.asset_id).toBeTruthy();
 expect(advanceDemoReview().publications).toBe(1);
 const assets = await ownAssetsApi.list().promise;
 expect(assets.items.some(v => v.asset_id === receipt.asset_id && v.state === 'ONLINE')).toBe(true);
 expect((await supplyApi.get(receipt.asset_id!).promise).display_name).toContain('索尼');
});

async function signOrder(id: string): Promise<void> {
 const c = await rentalOrderApi.contract(id).promise;
 registerMaterial('/assets/demo/device-1.png', 'CONTRACT_SIGNATURE_IMAGE', 'new-order-ink');
 const a = await rentalOrderApi.createSignature(id, { client_signature_id: 'client-new-order', signature_material_id: 'new-order-ink', agreement_sha256: c.value.agreement_sha256, order_terms_sha256: c.value.order_terms_sha256, replaces_attempt_id: null, replaces_attempt_version: null }, c.etag).promise;
 await rentalOrderApi.confirmSignature(id, 'client-new-order', { preview_artifact_id: a.value.preview_artifact_id!, preview_sha256: a.value.preview_sha256!, accepted: true }, a.etag).promise;
}

function demoDateAfter(days: number): string { return new Date(Math.floor(Date.now() / 86400000) * 86400000 + days * 86400000).toISOString(); }
