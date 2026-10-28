import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { advanceDemoDay, demoDate, handleDemo, readDemo, recordDemoPayment, registerMaterial, resetDemo, runDemoEvent, runDemoExtra, previewAdminReview, saveAdminReview, syncAdminCatalog } from '../miniprogram/preview/engine';
import { rules } from '../miniprogram/preview/rule-core';
import { assertLotteryAttempt, assertRedemptionAttempt } from '../miniprogram/shared/presentation/loyalty';
import { ACCOUNT, type Row } from '../miniprogram/preview/seed';
import { assertOrderPayment } from '../miniprogram/shared/presentation/rental-order-payment';
import { validateCatalogProductPage, validateCatalogProduct } from '../miniprogram/shared/api/publication-api';
let sequence = 0;
const read = (path: string) => handleDemo('GET', path).data;
function write(path: string, body: Row = {}, aggregate?: string, key = 'rule-intent-' + ++sequence, method = 'POST') {
 return handleDemo(method, path, body, { 'Idempotency-Key': key, ...(aggregate ? { 'If-Match': handleDemo('GET', aggregate).headers.etag } : {}) }).data;
}
const path = (id: string) => '/v1/me/rental-orders/' + id;
function selection(asset = 'asset-1', coupon: string | null = null): Row {
 return { asset_id: asset, rental_start_at: '2026-10-16T02:00:00Z', rental_end_at: '2026-10-18T02:00:00Z', delivery_method: asset === 'asset-2' ? 'EXPRESS' : 'CABINET', address_id: asset === 'asset-2' ? 'address-2' : null, coupon_id: coupon };
}
function prepare(body = selection()): Row { const quote = write('/v1/me/rental-quotes', body); return write('/v1/me/rental-orders/preparations', { ...body, accepted_terms_hash: quote.terms_hash }); }
function sign(d: Row): void {
 const root = path(d.order.order_id), contract = read(root + '/contract');
 registerMaterial('/assets/demo/device-1.png', 'CONTRACT_SIGNATURE_IMAGE', 'rule-signature');
 const a = write(root + '/contract/signature-attempts', { client_signature_id: 'rule-client-signature', signature_material_id: 'rule-signature', agreement_sha256: contract.agreement_sha256, order_terms_sha256: contract.order_terms_sha256 });
 write(root + '/contract/signature-attempts/' + a.client_signature_id + '/confirm', { accepted: true, preview_artifact_id: a.preview_artifact_id, preview_sha256: a.preview_sha256 });
 write(root + '/confirm', {}, root);
}
function pay(d: Row, purpose = 'INITIAL'): Row {
 const root = path(d.order.order_id), current = read(root);
 const p = write(root + '/payments', { purpose, supplement_id: purpose === 'SUPPLEMENT' ? current.bill.supplement.supplement_id : null }, root);
 assertOrderPayment(p as never, current as never, purpose as 'INITIAL' | 'SUPPLEMENT', p.payment_id);
 recordDemoPayment(p.payment_id, 'SUCCESS');
 write('/v1/me/rental-payments/' + p.payment_id + '/reconciliation', {}, '/v1/me/rental-payments/' + p.payment_id);
 return p;
}
function evidence(d: Row): void {
 const root = path(d.order.order_id);
 for (const slot of ['appearance', 'accessories']) {
  const id = 'proof-' + slot + d.order.order_id; registerMaterial('/assets/demo/device-1.png', 'EVIDENCE_IMAGE', id);
  write(root + '/return/evidence-slots/' + slot + '/items/1', { material_id: id }, root + '/return', undefined, 'PUT');
 }
}
function returnCabinet(d: Row): void {
 const root = path(d.order.order_id); write(root + '/return-draft', { method: 'CABINET' }, root); evidence(d);
 const task = write(root + '/cabinet-tasks', { cabinet_id: 'cabinet-1', compartment_id: 'slot-1' }, root), taskPath = '/v1/me/rental-cabinet-tasks/' + task.task_id;
 write(taskPath + '/open', {}, taskPath); write(taskPath + '/confirm-return', {}, taskPath);
}
beforeEach(() => {
 vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-16T02:00:00Z')); sequence = 0;
 vi.stubGlobal('wx', { getStorageSync: () => '', setStorageSync: vi.fn() }); resetDemo();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test('publication catalog passes the original page validator with exact IDs and pagination', () => {
 const first=validateCatalogProductPage(read('/v1/me/catalog/products?page_size=5'));
 expect(first.items).toHaveLength(5);expect(first.page.has_more).toBe(true);
 const second=validateCatalogProductPage(read('/v1/me/catalog/products?page_size=20&cursor='+first.page.next_cursor));
 expect(second.page.has_more).toBe(false);expect(second.page.next_cursor).toBeUndefined();
 expect(validateCatalogProduct(read('/v1/me/catalog/products/product-1')).product_id).toBe('product-1');
 expect(()=>read('/v1/me/catalog/products/product-99')).toThrow('不存在');
});
test('admin catalog updates project into the publisher list without replacing unrelated products', () => {
 const original=validateCatalogProductPage(read('/v1/me/catalog/products'));
 const old=original.items[0]!, untouched=original.items[1]!;
 const item={product_id:'product-web-1',name:'已更新标准商品',model:'新型号',description:'演示说明',brand_id:'brand-web',brand_name:'演示品牌',category_id:'category-web',category_name:'演示分类',tags:[],status:'ACTIVE',version:'2',updated_at:'2026-10-16T02:00:00Z'};
 const command={method:'PATCH',path:'/v1/ops/catalog/products/product-web-1',body:{name:item.name},version:'"v1"'};
 const result=syncAdminCatalog(item,old.name,command,'sync-product-once');
 expect(result.mini_id).toBe(old.product_id);expect(syncAdminCatalog(item,old.name,command,'sync-product-once')).toEqual(result);
 expect(()=>syncAdminCatalog(item,old.name,{...command,body:{name:'其他'}},'sync-product-once')).toThrow('不能更换');
 const linked=validateCatalogProduct(read('/v1/me/catalog/products/'+old.product_id));expect(linked).toMatchObject({name:item.name,brand_name:item.brand_name,category_name:item.category_name});
 expect(validateCatalogProduct(read('/v1/me/catalog/products/'+untouched.product_id)).name).toBe(untouched.name);
 expect(read('/v1/me/catalog/categories').items.some((v: Row)=>v.name==='演示分类')).toBe(true);
 syncAdminCatalog({...item,status:'INACTIVE',version:'3'},item.name,{...command,path:command.path+'/deactivate'},'sync-product-stop');
 expect(()=>read('/v1/me/catalog/products/'+old.product_id)).toThrow('不存在');expect(readDemo().supplies[0]!.display_name).toBe(old.name);
});
test('a new admin draft remains hidden until activated and receives its own identity', () => {
 const item={product_id:'product-web-new',name:'新建演示商品',model:'N1',description:'演示',brand_id:'brand-web',brand_name:'演示品牌',category_id:'category-web',category_name:'演示分类',tags:[],status:'DRAFT',version:'1',updated_at:'2026-10-16T02:00:00Z'};
 const created=syncAdminCatalog(item,'',{method:'POST'},'sync-new-product');expect(created.mini_id).toBe('admin-product-web-new');
 expect(read('/v1/me/catalog/products?query=新建演示商品').items).toHaveLength(0);
 syncAdminCatalog({...item,status:'ACTIVE',version:'2'},item.name,{method:'POST',activate:true},'sync-new-activate');
 expect(validateCatalogProduct(read('/v1/me/catalog/products/'+created.mini_id))).toMatchObject({name:'新建演示商品',media:[]});
});
test('legacy seed verification times are hidden only in the response without changing saved data', () => {
 const d=readDemo().orders.find(v=>v.order.order_id==='order-6')!, payment=d.bill.initial_payment;
 payment.created_at='2026-10-15T00:00:00Z';payment.last_verified_at='2025-01-01T00:00:00Z';
 expect(read(path('order-6')).bill.initial_payment.last_verified_at).toBeNull();expect(payment.last_verified_at).toBe('2025-01-01T00:00:00Z');
 payment.last_verified_at='2026-10-16T00:00:00Z';expect(read(path('order-6')).bill.initial_payment.last_verified_at).toBe(payment.last_verified_at);
});

test('first and repeated daily check-in share a receipt and real point ledger links', () => {
 const a = write('/v1/me/check-ins'), b = write('/v1/me/check-ins');
 expect(b).toEqual(a); expect(a.check_in.streak_days).toBe('1'); expect(a.check_in.cumulative_days).toBe('1');
 expect(a.grants.map((v: Row) => v.reward_units)).toEqual(['100', '500']); expect(readDemo().pink).toBe(29400);
 expect(read('/v1/me/check-ins?month=2026-10').items[0]).toEqual(a);
 expect(read('/v1/me/check-ins/' + a.check_in.check_in_id)).toEqual(a);
 for (const g of a.grants) expect(read('/v1/me/point-entries/' + g.point_entry_id).source_id).toBe(a.check_in.check_in_id);
});
test('seven days award first/daily/streak once; a skipped day resets streak without repeating first reward', () => {
 let receipt: Row = {};
 for (let i = 0; i < 7; i++) { if (i) advanceDemoDay(); receipt = write('/v1/me/check-ins'); }
 expect(receipt.check_in.streak_days).toBe('7'); expect(receipt.grants.map((v: Row) => v.reward_units)).toEqual(['100', '300']);
 expect(readDemo().pink).toBe(30300);
 advanceDemoDay(); advanceDemoDay(); receipt = write('/v1/me/check-ins');
 expect(receipt.check_in.streak_days).toBe('1'); expect(receipt.check_in.cumulative_days).toBe('8'); expect(receipt.grants).toHaveLength(1);
});
test('Shanghai midnight and month filtering use the business clock', () => {
 vi.setSystemTime(new Date('2026-10-31T15:59:00Z')); write('/v1/me/check-ins'); expect(demoDate()).toBe('2026-10-31');
 vi.advanceTimersByTime(120000); const next = write('/v1/me/check-ins'); expect(next.check_in.business_date).toBe('2026-11-01'); expect(next.check_in.streak_days).toBe('2');
 expect(read('/v1/me/check-ins?month=2026-10').items).toHaveLength(1);
 expect(read('/v1/me/check-ins?month=2026-11').items).toHaveLength(1);
});
test('one-day coupon reduces rent; waiver reduces only deposit; publish coupon cannot quote', () => {
 const normal = write('/v1/me/rental-quotes', selection()); const rent = write('/v1/me/rental-quotes', selection('asset-1', 'coupon-3'));
 expect(rent.fees.rent_discount_fen).toBe('8000'); expect(rent.fees.deposit_due_fen).toBe(normal.fees.deposit_due_fen);
 const waiver = write('/v1/me/rental-quotes', selection('asset-1', 'coupon-1')); expect(waiver.fees.deposit_due_fen).toBe('0'); expect(waiver.fees.rent_discount_fen).toBe('0');
 expect(() => write('/v1/me/rental-quotes', selection('asset-1', 'coupon-2'))).toThrow('此券不能');
});
test.each([
 ['missing asset', { asset_id: 'absent' }], ['past', { rental_start_at: '2026-10-15T02:00:00Z' }], ['partial day', { rental_end_at: '2026-10-18T03:00:00Z' }], ['negative term', { rental_end_at: '2026-10-15T02:00:00Z' }], ['delivery', { delivery_method: 'EXPRESS' }], ['expired coupon', { coupon_id: 'coupon-12' }], ['missing coupon', { coupon_id: 'absent' }],
])('invalid quote is rejected: %s', (_, override) => { expect(() => write('/v1/me/rental-quotes', { ...selection(), ...override })).toThrow(); expect(readDemo().orders).toHaveLength(20); });
test('stale quote, changed amount and altered address cannot create an order', () => {
 const input = selection(), quoted = write('/v1/me/rental-quotes', input);
 readDemo().supplies[0]!.unit_price_fen = '9000';
 expect(() => write('/v1/me/rental-orders/preparations', { ...input, accepted_terms_hash: quoted.terms_hash })).toThrow('报价');
 expect(readDemo().orders).toHaveLength(20);
});
test('preparation holds inventory and coupon; cancel releases both without consumption', () => {
 const input = selection('asset-1', 'coupon-1'), d = prepare(input), root = path(d.order.order_id);
 expect(() => prepare(input)).toThrow('占用'); expect(readDemo().coupons[0]!.status).toBe('AVAILABLE');
 write(root + '/cancel-unpaid', {}, root); expect(read(root).order.stage).toBe('CLOSED'); expect(prepare(input).order.stage).toBe('PREPARING');
});
test('expiry closes unpaid orders and releases inventory; paid order cannot be cancelled', () => {
 const d = prepare(); vi.advanceTimersByTime(31 * 60000); expect(read(path(d.order.order_id)).order.stage).toBe('CLOSED'); expect(prepare().order.stage).toBe('PREPARING');
 const other = prepare(selection('asset-2')); sign(other); pay(other); expect(() => write(path(other.order.order_id) + '/cancel-unpaid', {}, path(other.order.order_id))).toThrow();
});
test('confirm requires a verified signature and consumes contract quota exactly once', () => {
 const d = prepare(), root = path(d.order.order_id); expect(() => write(root + '/confirm', {}, root)).toThrow('签名');
 sign(d); expect(rules(readDemo()).entitlements.CONTRACT).toBe(35); expect(() => write(root + '/confirm', {}, root)).toThrow(); expect(rules(readDemo()).entitlements.CONTRACT).toBe(35);
});
test('idempotency rejects changed bodies and replays before stale-version checks', () => {
 const body = selection(), q = write('/v1/me/rental-quotes', body), request = { ...body, accepted_terms_hash: q.terms_hash };
 const a = write('/v1/me/rental-orders/preparations', request, undefined, 'same-key');
 expect(write('/v1/me/rental-orders/preparations', request, undefined, 'same-key')).toEqual(a); expect(readDemo().orders).toHaveLength(21);
 expect(() => write('/v1/me/rental-orders/preparations', { ...request, coupon_id: 'coupon-1' }, undefined, 'same-key')).toThrow('幂等');
});
test('stale entity version cannot mutate state', () => {
 const d = prepare(), root = path(d.order.order_id);
 expect(() => handleDemo('POST', root + '/cancel-unpaid', {}, { 'If-Match': '"DEMO:2:999"' })).toThrow('对象已经变化'); expect(read(root).order.stage).toBe('PREPARING');
});
test.each(['FAILED', 'UNKNOWN', 'CANCELLED'])('payment %s remains unpaid until explicit provider success and reconciliation', outcome => {
 const d = prepare(), root = path(d.order.order_id); sign(d); const p = write(root + '/payments', { purpose: 'INITIAL', supplement_id: null }, root), pp = '/v1/me/rental-payments/' + p.payment_id;
 recordDemoPayment(p.payment_id, outcome); write(pp + '/reconciliation', {}, pp); expect(read(root).order.stage).toBe('AWAITING_PAYMENT');
 recordDemoPayment(p.payment_id, 'SUCCESS'); expect(read(root).order.stage).toBe('AWAITING_PAYMENT'); write(pp + '/reconciliation', {}, pp); expect(read(root).order.stage).toBe('ACTIVE');
 const amount = read(root).bill.funds_summary.gross_received_fen; write(pp + '/reconciliation', {}, pp); expect(read(root).bill.funds_summary.gross_received_fen).toBe(amount);
});
test('complete cabinet order preserves fees, evidence, task identity and refund conservation', () => {
 const d = prepare(), root = path(d.order.order_id); sign(d); pay(d); runDemoEvent(d.order.order_id, 'DELIVER'); returnCabinet(d);
 expect(read(root).order.display_status_code).toBe('RETURN_REVIEW'); runDemoEvent(d.order.order_id, 'REVIEW');
 const refund = read(root).bill.refund_summary.latest_refund, rp = '/v1/me/rental-refunds/' + refund.refund_id;
 write(rp + '/reconciliation', {}, rp); expect(read(root).order.display_status_code).toBe('REFUND_PROCESSING');
 runDemoEvent(d.order.order_id, 'REFUND_SUCCESS'); write(rp + '/reconciliation', {}, rp);
 const done = read(root); expect(done.order.stage).toBe('COMPLETED'); expect(done.fees).toEqual(d.fees);
 expect(done.bill.funds_summary.net_received_fen).toBe(String(Number(d.fees.rent_gross_fen) - Number(d.fees.rent_discount_fen)));
 write(rp + '/reconciliation', {}, rp); expect(read(root).bill.deposit_refunded_fen).toBe(d.fees.deposit_due_fen);
});
test('express return requires material and address version before shipping, then explicit receipt and review', () => {
 const d = prepare(selection('asset-2')), root = path(d.order.order_id); sign(d); pay(d); runDemoEvent(d.order.order_id, 'DELIVER');
 write(root + '/return-draft', { method: 'EXPRESS' }, root);
 expect(() => write(root + '/return/shipment', { tracking_no: 'SFDEMO123', confirmed_address_version: '1' }, root + '/return')).toThrow('材料');
 evidence(d); write(root + '/return/shipment', { tracking_no: 'SFDEMO123', confirmed_address_version: '1', carrier: '演示物流' }, root + '/return');
 runDemoEvent(d.order.order_id, 'RECEIVE'); runDemoEvent(d.order.order_id, 'REVIEW_SUPPLEMENT');
 expect(read(root).order.display_status_code).toBe('AWAITING_SUPPLEMENT'); pay(d, 'SUPPLEMENT'); expect(read(root).order.display_status_code).toBe('COMPLETED');
 expect(read(root).bill.deposit_refunded_fen).toBe('0');expect(read(root).bill.deducted_fen).toBe(d.fees.deposit_due_fen);
 expect(read(root).bill.funds_summary.gross_received_fen).toBe(String(Number(d.fees.initial_due_fen) + 6000));
});
test('linked final review deducts assessed overtime from deposit and replays without duplicate refund', () => {
 const id='order-6',d=readDemo().orders.find(v=>v.order.order_id===id)!,ret=read(path(id)+'/return');
 const input={decision:'APPROVE_FINAL',receipt_version:ret.version,overtime_assessed_fen:'40000',adjustment_reason:'模拟调整',loss_items:[],missing_items:[],evidence_ids:[],rejection_reason:null};
 const preview=previewAdminReview(id,input,d.order.version);expect(preview).toMatchObject({overtime_fen:'0',deducted_fen:'40000',refund_due_fen:'260000',supplement_due_fen:'0'});
 const version=d.order.version, review=saveAdminReview(id,input,version,'linked-fees-once');
 expect(saveAdminReview(id,input,version,'linked-fees-once')).toEqual(review);
 const current=read(path(id));expect(current.order.display_status_code).toBe('REFUND_PROCESSING');expect(current.bill.refund_summary.latest_refund.amount_fen).toBe('260000');
});
test('linked review calculates overdue time in rounded units after the grace period', () => {
 const id='order-6',d=readDemo().orders.find(v=>v.order.order_id===id)!,ret=read(path(id)+'/return');
 d.demoPricing={unit_seconds:3600,unit_price_fen:'6000',grace_seconds:3600};d.order.rental_end_at='2026-10-15T00:00:00Z';readDemo().returns[id]!.received_at='2026-10-15T01:00:01Z';
 const input={decision:'REVIEW_PENDING',receipt_version:ret.version,overtime_assessed_fen:null,adjustment_reason:null,loss_items:[],missing_items:[],evidence_ids:[],rejection_reason:'查看计费'};
 expect(previewAdminReview(id,input,d.order.version).overtime_fen).toBe('6000');
 expect(()=>previewAdminReview(id,{...input,decision:'APPROVE_FINAL',overtime_assessed_fen:'0',rejection_reason:null},d.order.version)).toThrow('调整原因');
});
test('pending review preserves the deposit and idempotently records its reason', () => {
 const id='order-6', d=readDemo().orders.find(v=>v.order.order_id===id)!, ret=read(path(id)+'/return');
 const input={decision:'REVIEW_PENDING',receipt_version:ret.version,overtime_assessed_fen:null,adjustment_reason:null,loss_items:[],missing_items:[],evidence_ids:[],rejection_reason:'等待核实'};
 const version=d.order.version, oldBill=structuredClone(d.bill), review=saveAdminReview(id,input,version,'pending-review-once');
 expect(review.decision).toBe('REVIEW_PENDING');expect(saveAdminReview(id,input,version,'pending-review-once')).toEqual(review);
 expect(read(path(id)).order.review_status).toBe('DISPUTED');expect(d.bill.deposit_received_fen).toBe(oldBill.deposit_received_fen);expect(d.bill.finalized).toBe(oldBill.finalized);
 expect(()=>saveAdminReview(id,{...input,rejection_reason:'其他原因'},version,'pending-review-once')).toThrow('同一审核键');
});
test('material review requires and accepts the specified replacement before final settlement', () => {
 const id='order-6',root=path(id),d=readDemo().orders.find(v=>v.order.order_id===id)!,ret=read(root+'/return');
 const input={decision:'MATERIAL_REQUIRED',receipt_version:ret.version,overtime_assessed_fen:null,adjustment_reason:null,loss_items:[],missing_items:[{slot_key:'appearance',item_no:1,evidence_id:null,reason:'请补拍正面'}],evidence_ids:[],rejection_reason:'照片不清晰'};
 saveAdminReview(id,input,d.order.version,'material-review-once');
 expect(read(root).order.review_status).toBe('MATERIAL_REQUIRED');expect(read(root+'/return').pre_return_complete).toBe(false);expect(d.bill.finalized).toBe(false);
 registerMaterial('/assets/demo/device-2.png','EVIDENCE_IMAGE','replacement-proof');
 expect(()=>write(root+'/return/evidence-slots/accessories/items/1',{material_id:'replacement-proof',reason:'补拍'},root+'/return',undefined,'PUT')).toThrow('只能补交');
 write(root+'/return/evidence-slots/appearance/items/1',{material_id:'replacement-proof',reason:'补拍'},root+'/return',undefined,'PUT');
 const updated=read(root+'/return');expect(updated.pre_return_complete).toBe(true);expect(read(root).order.review_status).toBe('PENDING');
 const final={decision:'APPROVE_FINAL',receipt_version:updated.version,overtime_assessed_fen:'0',adjustment_reason:null,loss_items:[],missing_items:[],evidence_ids:[],rejection_reason:null};
 saveAdminReview(id,final,read(root).order.version,'material-final-once');expect(read(root).bill.refund_summary.latest_refund.amount_fen).toBe('300000');
});
test('loss deduction requires evidence and allocates the confirmed amount from the deposit', () => {
 const id='order-6',root=path(id),d=readDemo().orders.find(v=>v.order.order_id===id)!,ret=read(root+'/return');
 const input={decision:'APPROVE_FINAL',receipt_version:ret.version,overtime_assessed_fen:'0',adjustment_reason:null,loss_items:[{description:'屏幕损坏',confirmed_fen:'40000',evidence_ids:[]}],missing_items:[],evidence_ids:[],rejection_reason:null};
 expect(()=>previewAdminReview(id,input,d.order.version)).toThrow('须提供凭证');
 registerMaterial('/assets/demo/device-1.png','EVIDENCE_IMAGE','loss-proof');input.loss_items[0]!.evidence_ids=['loss-proof'] as never[];
 expect(previewAdminReview(id,input,d.order.version)).toMatchObject({loss_fen:'40000',deducted_fen:'40000',refund_due_fen:'260000'});
 const version=d.order.version,result=saveAdminReview(id,input,version,'loss-review-once');expect(saveAdminReview(id,input,version,'loss-review-once')).toEqual(result);
 expect(read(root).bill.refund_summary.latest_refund.amount_fen).toBe('260000');
});
test('linked review over the deposit creates only the difference as supplement and no refund after payment', () => {
 const id='order-6',d=readDemo().orders.find(v=>v.order.order_id===id)!,ret=read(path(id)+'/return');
 const input={decision:'APPROVE_FINAL',receipt_version:ret.version,overtime_assessed_fen:'306000',adjustment_reason:'模拟调整',loss_items:[],missing_items:[],evidence_ids:[],rejection_reason:null};
 expect(previewAdminReview(id,input,d.order.version)).toMatchObject({deducted_fen:'300000',refund_due_fen:'0',supplement_due_fen:'6000'});
 saveAdminReview(id,input,d.order.version,'linked-supplement-once');expect(read(path(id)).order.display_status_code).toBe('AWAITING_SUPPLEMENT');
 pay(d,'SUPPLEMENT');const finished=read(path(id));expect(finished.order.stage).toBe('COMPLETED');expect(finished.bill.deposit_refunded_fen).toBe('0');expect(finished.bill.refund_summary.latest_refund).toBeNull();
});
test('return rejects missing material and confirmation before cabinet open', () => {
 const d = prepare(), root = path(d.order.order_id); sign(d); pay(d); runDemoEvent(d.order.order_id, 'DELIVER'); write(root + '/return-draft', { method: 'CABINET' }, root);
 expect(() => write(root + '/cabinet-tasks', { cabinet_id: 'cabinet-1', compartment_id: 'slot-1' }, root)).toThrow('材料');
 expect(() => write(root + '/return/evidence-slots/appearance/items/1', { material_id: 'unregistered' }, root + '/return', undefined, 'PUT')).toThrow('素材');
 evidence(d); const task = write(root + '/cabinet-tasks', { cabinet_id: 'cabinet-1', compartment_id: 'slot-1' }, root), tp = '/v1/me/rental-cabinet-tasks/' + task.task_id;
 expect(() => write(tp + '/confirm-return', {}, tp)).toThrow('先完成开柜'); write(tp + '/cancel', {}, tp); expect(read(tp).status).toBe('CANCELLED');
 expect(write(root + '/cabinet-tasks', { cabinet_id: 'cabinet-1', compartment_id: 'slot-1' }, root).task_id).not.toBe(task.task_id);
});
test('coupon redemption only accepts publish coupon and grants exactly one unit with a trace', () => {
 expect(() => write('/v1/me/coupons/coupon-3/redemptions', { expected_coupon_version: '1' })).toThrow('此类型');
 const a = write('/v1/me/coupons/coupon-2/redemptions', { expected_coupon_version: '1' }, undefined, 'redeem-key'); assertRedemptionAttempt(a as never, ACCOUNT);
 expect(rules(readDemo()).entitlements.PUBLISH_QUOTA).toBe(37); expect(read('/v1/me/entitlement-movements/' + a.movement_id).quantity).toBe('1');
 expect(write('/v1/me/coupons/coupon-2/redemptions', { expected_coupon_version: '1' }, undefined, 'redeem-key')).toEqual(a);
 expect(() => write('/v1/me/coupons/coupon-2/redemptions', { expected_coupon_version: '1' })).toThrow(); expect(rules(readDemo()).entitlements.PUBLISH_QUOTA).toBe(37);
});
test('six deterministic demonstration draw outcomes have queryable receipts, coupon grants and no-win', () => {
 const attempts: Row[] = [];
 for (let i = 0; i < 6; i++) {
  const a = write('/v1/me/lottery-draws', { confirmed_cost_pink_units: '50', expected_lottery_config_version_id: 'lottery-demo', expected_coupon_config_version_id: 'coupon-demo' }); attempts.push(a); assertLotteryAttempt(a as never, ACCOUNT);
  expect(read('/v1/me/lottery-attempts/' + a.attempt_id)).toEqual(a);
 }
 expect(attempts[5]!.result_kind).toBe('NO_WIN'); expect(readDemo().pink).toBe(28600); expect(readDemo().coupons).toHaveLength(16);
});
test('insufficient purchase balance rolls back all ledgers and entitlements', () => {
 readDemo().pink = 10; expect(() => write('/v1/me/entitlement-purchases', { offer_code: 'contract-demo', quantity: '1', cost_unit: 'PINK_POINT' })).toThrow('余额不足');
 expect(readDemo().pink).toBe(10); expect(readDemo().purchases).toHaveLength(0); expect(rules(readDemo()).entitlements.CONTRACT).toBe(36);
});
test('payment invocation uses the installed public app identity and original payment', () => {
 rules(readDemo()).appId = 'offline-test-app'; const d = prepare(); sign(d); const root = path(d.order.order_id);
 const p = write(root + '/payments', { purpose: 'INITIAL', supplement_id: null }, root);
 const invocation = write('/v1/me/rental-payments/' + p.payment_id + '/invocation', {}, '/v1/me/rental-payments/' + p.payment_id);
 expect(invocation.payment_id).toBe(p.payment_id); expect(Date.parse(invocation.expires_at)).toBeGreaterThan(Date.now()); expect(read(root).order.allowed_actions.some((v: Row) => v.action_code === 'QUERY_PAYMENT')).toBe(true); expect(invocation.app_id).toBe('offline-test-app'); expect(invocation.package).toContain(p.payment_id);
});
test('unknown payment holds the original inventory past timeout and blocks cancellation', () => {
 const d = prepare(); sign(d); const root = path(d.order.order_id);
 const p = write(root + '/payments', { purpose: 'INITIAL', supplement_id: null }, root);
 recordDemoPayment(p.payment_id, 'UNKNOWN'); vi.advanceTimersByTime(6 * 60000);
 expect(read(root).order.stage).toBe('AWAITING_PAYMENT'); expect(() => write(root + '/cancel-unpaid', {}, root)).toThrow(); expect(() => prepare()).toThrow('占用');
 recordDemoPayment(p.payment_id, 'SUCCESS'); write('/v1/me/rental-payments/' + p.payment_id + '/reconciliation'); expect(read(root).order.stage).toBe('ACTIVE');
});
test('old persisted sign-in dates are preserved without issuing duplicate rewards', () => {
 readDemo().checkedDates = ['2026-10-16']; const prior = readDemo().pink;
 const receipt = write('/v1/me/check-ins'); expect(receipt.grants).toEqual([]); expect(readDemo().pink).toBe(prior);
 advanceDemoDay(); const next = write('/v1/me/check-ins'); expect(next.check_in.streak_days).toBe('2'); expect(next.grants).toHaveLength(1);
});
test('withdrawal updates the same wallet and history; invalid amounts leave it unchanged', () => {
 const first = write('/v1/me/withdrawals', { amount_fen: '10000' }, undefined, 'wallet-once');
 expect(read('/v1/me/cash-balance').available_fen).toBe('118800');
 expect(write('/v1/me/withdrawals', { amount_fen: '10000' }, undefined, 'wallet-once')).toEqual(first);
 expect(read('/v1/me/withdrawals').items).toHaveLength(1);
 expect(() => write('/v1/me/withdrawals', { amount_fen: '118801' })).toThrow('余额不足');
 expect(() => write('/v1/me/withdrawals', { amount_fen: '1.5' })).toThrow('整数'); expect(read('/v1/me/cash-balance').available_fen).toBe('118800');
});
test('demo service and mall purchases share balance and replay without duplicate deductions', () => {
 const before=readDemo().pink, count=readDemo().coupons.length;
 const purchase=runDemoExtra('servicePurchase',{quantity:5,service:'contract'},'extra-service-once');
 expect(readDemo().pink).toBe(before-500);expect(readDemo().rules?.entitlements.CONTRACT).toBe(41);
 expect(runDemoExtra('servicePurchase',{quantity:5,service:'contract'},'extra-service-once')).toEqual(purchase);
 expect(readDemo().pink).toBe(before-500);
 expect(()=>runDemoExtra('servicePurchase',{quantity:10,service:'contract'},'extra-service-once')).toThrow('不能更换内容');
 const coupon=runDemoExtra('mallRedeem',{product:'rental-10'},'extra-mall-once');
 expect(readDemo().pink).toBe(before-600);expect(readDemo().coupons).toHaveLength(count+1);
 expect(runDemoExtra('mallRedeem',{product:'rental-10'},'extra-mall-once')).toEqual(coupon);
 expect(readDemo().coupons).toHaveLength(count+1);
 readDemo().pink=50;expect(()=>runDemoExtra('mallRedeem',{product:'rental-20'},'extra-no-funds')).toThrow('余额不足');
 expect(readDemo().pink).toBe(50);expect(readDemo().coupons).toHaveLength(count+1);
});
test('demo dispute submission and confirmation persist through the same state', () => {
 const first=runDemoExtra('dispute',{description:'设备外观情况',imagePaths:[]},'extra-dispute-once');
 expect(first.status).toBe('SUBMITTED');expect(runDemoExtra('dispute',{description:'设备外观情况',imagePaths:[]},'extra-dispute-once')).toEqual(first);
 expect(runDemoExtra('disputeAccept',{},'extra-accept-once').status).toBe('ACCEPTED');
 expect(readDemo().receipts['demo-dispute']?.status).toBe('ACCEPTED');
});
test('purchase balance, quota summary and movements agree after earning and spending', () => {
 write('/v1/me/entitlement-purchases', { offer_code: 'publish_quota-demo', quantity: '2', cost_unit: 'PINK_POINT' });
 expect(readDemo().pink).toBe(28600); const quota = read('/v1/me/benefits').entitlements.find((v: Row) => v.kind === 'PUBLISH_QUOTA');
 expect(quota.available_qty).toBe('38'); expect(Number(quota.granted_qty) - Number(quota.consumed_qty)).toBe(Number(quota.available_qty));
 expect(read('/v1/me/entitlement-movements').items[0].quantity).toBe('2');
});
test('growth task replay cannot grant twice and both point ledgers reference the task', () => {
 const a = write('/v1/me/growth-tasks/task-1/claims'), again = write('/v1/me/growth-tasks/task-1/claims');
 expect(again.replayed).toBe(true); expect(readDemo().pink).toBe(28850); expect(readDemo().growth).toBe(12900);
 for (const g of a.grants) expect(read('/v1/me/point-entries/' + g.point_entry_id).source_id).toBe('task-1');
 expect(read('/v1/me/growth-tasks').items[0].claimable_count).toBe('0');
});
test('publication validates required evidence and consumes quota once', () => {
 const draft = readDemo().drafts[0]!; draft.asset.media = [];
 expect(() => write('/v1/me/asset-drafts/draft-demo/submissions')).toThrow('权属'); expect(rules(readDemo()).entitlements.PUBLISH_QUOTA).toBe(36);
});
test('post-payment read models satisfy the original UI validation for both primary and supplement samples', () => {
 for (const id of ['order-2', 'order-7']) {
  const d = read(path(id)); const purpose = id === 'order-7' ? 'SUPPLEMENT' : 'INITIAL';
  const p = purpose === 'INITIAL' ? d.bill.initial_payment : d.bill.supplement.active_payment;
  expect(() => assertOrderPayment(p as never, d as never, purpose, p.payment_id)).not.toThrow();
 }
});
