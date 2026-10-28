import { ACCOUNT, action, clone, evidenceTemplate, makeOrder, makeReturn, media, schema, statuses, type DemoState, type Row } from './seed';
import { checkVersion, entitlement, iso, list, nextId, quantity, requireRule, rules, time } from './rule-core';

const commands: Record<string, string[]> = { PREPARING: ['SIGN_CONTRACT', 'CANCEL_UNPAID'], AWAITING_PAYMENT: ['PAY_INITIAL', 'QUERY_PAYMENT', 'CANCEL_UNPAID'], AWAITING_DELIVERY: ['READ_PICKUP_CODE', 'PICKUP'], IN_USE: ['START_RETURN'], RETURNING: ['SAVE_RETURN_EVIDENCE', 'SHIP_RETURN', 'SELECT_COMPARTMENT'], RETURN_REVIEW: ['READ_RETURN'], AWAITING_SUPPLEMENT: ['PAY_SUPPLEMENT', 'QUERY_PAYMENT'], REFUND_PROCESSING: ['QUERY_REFUND'], COMPLETED: [], CLOSED: [] };
export function finance(d: Row): void {
 const initial = d.bill.initial_payment, supplement = d.bill.supplement;
 const paid = initial.status === 'SUCCEEDED' ? Number(initial.amount_fen) : 0;
 const extra = supplement?.paid_payment?.status === 'SUCCEEDED' ? Number(supplement.paid_payment.amount_fen) : 0;
 const refund = Number(d.bill.deposit_refunded_fen ?? 0);
 d.order.initial_paid_fen = String(paid); d.order.initial_payer_total_fen = String(paid);
 d.bill.deposit_received_fen = paid ? d.fees.deposit_due_fen : '0';
 d.bill.funds_summary = { ...d.bill.funds_summary, gross_received_fen: String(paid + extra), payer_total_fen: String(paid + extra), refunded_fen: String(refund), payer_refund_fen: String(refund), net_received_fen: String(paid + extra - refund), payer_net_fen: String(paid + extra - refund), currency: 'CNY' };
 requireRule(paid + extra >= refund, '演示账务不守恒');
}
export function projectOrder(s: DemoState, d: Row): Row {
 d.server_time = iso(s);
 const state = d.order.display_status_code, signed = s.signatures[d.order.order_id]?.status === 'CONFIRMED';
 let codes = [...(commands[state] ?? [])];
 if (state === 'PREPARING' && signed) codes = ['CONFIRM_ORDER', 'VIEW_CONTRACT', 'CANCEL_UNPAID'];
 if (state === 'AWAITING_DELIVERY') codes = d.delivery.method === 'CABINET' ? ['READ_PICKUP_CODE', 'PICKUP'] : d.order.viewer_role === 'LESSOR' ? ['SHIP'] : ['CONFIRM_DELIVERY'];
 if (d.order.viewer_role === 'LESSOR') codes = state === 'RETURNING' ? ['READ_RETURN', 'CONFIRM_RETURN_RECEIPT'] : ['AWAITING_PAYMENT', 'PREPARING', 'IN_USE'].includes(state) ? [] : codes;
 if (['UNKNOWN', 'SUCCESS'].includes(rules(s).paymentResults[d.bill.initial_payment.payment_id])) codes = codes.filter(v => v !== 'CANCEL_UNPAID');
 d.order.allowed_actions = [...new Set([...codes, 'VIEW_CONTRACT'])].map(action);
 // Older synthetic seed payments inherited a dated OpenAPI example. Hide only
 // impossible verification timestamps in their response projection; retain the
 // existing shared state and any later, valid verification result unchanged.
 const payments = [d.bill.initial_payment, d.bill.supplement?.active_payment, d.bill.supplement?.paid_payment];
 if (String(d.order.order_no).startsWith('RO-DEMO-') && payments.some(p => p?.last_verified_at && Date.parse(p.last_verified_at) < Date.parse(p.created_at))) {
  const result = clone(d);
  for (const p of [result.bill.initial_payment, result.bill.supplement?.active_payment, result.bill.supplement?.paid_payment]) {
   if (p?.last_verified_at && Date.parse(p.last_verified_at) < Date.parse(p.created_at)) p.last_verified_at = null;
  }
  return result;
 }
 return d;
}
export function transitionOrder(s: DemoState, d: Row, index: number): Row {
 const status = statuses[index]!;
 Object.assign(d.order, { display_status_code: status[0], display_status: status[1], stage: status[2], physical_status: status[3], review_status: status[4], version: String(Number(d.order.version) + 1) });
 d.server_time = iso(s);
 if (index === 8) { d.completed_at = iso(s); d.reservation_active = false; }
 if (index === 9) { d.closed_at = iso(s); d.reservation_active = false; }
 finance(d); return projectOrder(s, d);
}
export function expireOrders(s: DemoState): void {
 for (const d of s.orders) if (['PREPARING', 'AWAITING_PAYMENT'].includes(d.order.stage) && Date.parse(d.order.stage === 'PREPARING' ? d.hold_expires_at : d.order.payment_due_at) <= time(s)) {
  if (['UNKNOWN', 'SUCCESS'].includes(rules(s).paymentResults[d.bill.initial_payment.payment_id])) continue;
  d.close_reason = 'EXPIRED'; closeOrder(s, d);
 }
}
function closeOrder(s: DemoState, d: Row): void {
 requireRule(!['UNKNOWN', 'SUCCESS'].includes(rules(s).paymentResults[d.bill.initial_payment.payment_id]) && d.bill.initial_payment.status !== 'SUCCEEDED', '已支付订单不能按未支付取消');
 d.bill.initial_payment.status = 'CLOSED_UNPAID'; d.bill.initial_payment.version = String(Number(d.bill.initial_payment.version) + 1);
 const cid = d.selected_coupon_id;
 if (cid && rules(s).couponReservations[cid] === d.order.order_id) delete rules(s).couponReservations[cid];
 transitionOrder(s, d, 9);
}
function digest(value: unknown): string {
 const input = JSON.stringify(value), words = Array.from({ length: 8 }, (_, i) => 2166136261 + i * 31);
 for (const char of input) for (let i = 0; i < words.length; i++) words[i] = Math.imul(words[i]! ^ (char.charCodeAt(0) + i), 16777619) >>> 0;
 return words.map(v => v.toString(16).padStart(8, '0')).join(''); // Offline selection identity, not a cryptographic signature.
}
export function quote(s: DemoState, body: Row): Row {
 const asset = s.supplies.find(v => v.asset_id === body.asset_id);
 requireRule(asset, '设备不存在', 'RESOURCE_NOT_FOUND', 404);
 const start = Date.parse(body.rental_start_at), end = Date.parse(body.rental_end_at), unit = asset.rental_mode === 'HOUR' ? 3600000 : 86400000;
 const today = new Date(time(s) + 8 * 3600000).toISOString().slice(0, 10);
 requireRule(Number.isFinite(start) && Number.isFinite(end) && end > start && new Date(start + 8 * 3600000).toISOString().slice(0, 10) >= today, '租期须从今天或之后开始，结束须晚于开始', 'VALIDATION_FAILED', 422);
 requireRule((end - start) % unit === 0, '租期必须为完整的天或小时', 'VALIDATION_FAILED', 422);
 const units = (end - start) / unit, minimum = quantity(asset.minimum_units, '起租数量', 1);
 requireRule(units >= minimum && units <= (unit === 86400000 ? 30 : 720), '租期不满足起租量或超过演示上限', 'VALIDATION_FAILED', 422);
 requireRule(start >= Date.parse(asset.available_from) && end <= Date.parse(asset.available_until), '租期超出设备可租日期');
 requireRule(asset.availability_status === 'AVAILABLE' && asset.delivery_methods.includes(body.delivery_method), '设备不可租或不支持此交付方式');
 requireRule(body.delivery_method !== 'CABINET' || !body.address_id, '柜机取件不应填写快递地址', 'VALIDATION_FAILED', 422);
 requireRule(body.delivery_method !== 'EXPRESS' || s.addresses.some(v => v.address_id === body.address_id), '请选择有效收货地址', 'VALIDATION_FAILED', 422);
 const occupied = s.orders.some(d => d.reservation_active && d.order.asset.asset_id === asset.asset_id && !['CLOSED', 'COMPLETED'].includes(d.order.stage) && start < Date.parse(d.order.rental_end_at) && end > Date.parse(d.order.rental_start_at));
 requireRule(!occupied, '所选租期已有演示订单占用，请更换设备或日期');
 let coupon: Row | undefined;
 if (body.coupon_id) {
  coupon = s.coupons.find(v => v.coupon_id === body.coupon_id);
  requireRule(coupon && coupon.account_id === ACCOUNT && coupon.status === 'AVAILABLE' && !rules(s).couponReservations[coupon.coupon_id], '优惠券不可用或已被订单占用');
  requireRule(['DEPOSIT_WAIVER', 'ONE_DAY_RENT'].includes(coupon.coupon_type), '此券不能抵扣租金或押金');
 }
 const price = quantity(asset.unit_price_fen, '租金单价', 1), deposit = quantity(asset.deposit_fen, '押金');
 const gross = price * units, discount = coupon?.coupon_type === 'ONE_DAY_RENT' ? Math.min(units, unit === 3600000 ? 24 : 1) * price : 0, waived = coupon?.coupon_type === 'DEPOSIT_WAIVER' ? deposit : 0;
 requireRule(Number.isSafeInteger(gross + deposit), '金额超出可用范围', 'VALIDATION_FAILED', 422);
 const fees = { rent_gross_fen: String(gross), rent_discount_fen: String(discount), deposit_list_fen: String(deposit), deposit_waived_fen: String(waived), deposit_due_fen: String(deposit - waived), initial_due_fen: String(gross - discount + deposit - waived), currency: 'CNY' };
 return { ...schema('QuoteView'), terms_hash: digest({ asset: asset.asset_revision_id, fees, start, end, method: body.delivery_method, address: body.address_id ?? null, coupon: body.coupon_id ?? null, couponVersion: coupon?.version ?? null }), fees, max_payable_fen: fees.initial_due_fen, blockers: [], requirements: { ...schema('OrderRequirements'), allowed_return_methods: [body.delivery_method], return_evidence_template: evidenceTemplate, media: { photo_bytes_max: '10485760', video_bytes_max: '104857600', video_seconds_max: 60, photo_mime_types: ['image/png', 'image/jpeg'], video_mime_types: ['video/mp4'] } } };
}
function paymentFor(s: DemoState, id: string): { d: Row; p: Row } {
 for (const d of s.orders) for (const p of [d.bill.initial_payment, d.bill.supplement?.active_payment, d.bill.supplement?.paid_payment]) if (p?.payment_id === id) return { d, p };
 requireRule(false, '演示支付单不存在', 'RESOURCE_NOT_FOUND', 404);
}
export function paymentResult(s: DemoState, id: string, outcome: string): void {
 const { d, p } = paymentFor(s, id);
 requireRule(['SUCCESS', 'CANCELLED', 'FAILED', 'UNKNOWN'].includes(outcome), '模拟支付结果无效');
 requireRule(!['CLOSED', 'COMPLETED'].includes(d.order.stage) && p.status !== 'CLOSED_UNPAID', '订单已关闭');
 if (p.status === 'SUCCEEDED') return;
 rules(s).paymentResults[id] = outcome;
 p.status = outcome === 'UNKNOWN' ? 'UNKNOWN' : outcome === 'SUCCESS' ? 'PROCESSING' : p.status;
 p.allowed_actions = (outcome === 'UNKNOWN' || outcome === 'SUCCESS' ? ['QUERY_PAYMENT'] : ['INVOKE_PAYMENT', 'QUERY_PAYMENT']).map(action);
}
function returnFor(s: DemoState, d: Row): Row {
 const id = d.order.order_id;
 if (!s.returns[id]) {
  const r = makeReturn(d);
  if (d.reservation_active) Object.assign(r, { tracking_no: null, carrier: null, shipped_at: null, submitted_at: null, received_at: null, material_status: 'INCOMPLETE', pre_return_complete: false, evidence_slots: evidenceTemplate.slots.map(slot => ({ slot, items: [], complete: false, editable: true, blocker: null })), evidence_history: [], cabinet_task: null });
  s.returns[id] = r;
 }
 return s.returns[id]!;
}
function refreshEvidence(r: Row): void {
 const required: Row[] = Array.isArray(r.review_missing_items) ? r.review_missing_items : [];
 const incomplete = r.evidence_slots.filter((v: Row) => v.items.length < v.slot.min_count).map((v: Row) => ({slot_key:v.slot.slot_key,item_no:v.items.length+1,evidence_id:null,reason:v.slot.instruction}));
 r.missing_items = [...required, ...incomplete.filter((v: Row)=>!required.some(item=>item.slot_key===v.slot_key&&item.item_no===v.item_no))];
 r.pre_return_complete = r.missing_items.length === 0; r.material_status = r.pre_return_complete ? 'COMPLETE' : 'INCOMPLETE';
 for (const slot of r.evidence_slots) slot.complete = slot.items.length >= slot.slot.min_count && !required.some(item=>item.slot_key===slot.slot.slot_key);
}
export function beginRefund(s: DemoState, d: Row, overtime = 0, loss = 0): void {
 const deposit=Number(d.bill.deposit_received_fen), total=overtime+loss;
 requireRule([deposit,overtime,loss,total].every(value=>Number.isSafeInteger(value)&&value>=0),'演示费用无效','VALIDATION_FAILED',422);
 const deducted=Math.min(deposit,total), amount=Math.max(0,deposit-total), supplement=Math.max(0,total-deposit);
 Object.assign(d.bill,{finalized:true,overtime_fen:String(overtime),loss_fen:String(loss),deducted_fen:String(deducted),refund_due_fen:String(amount),supplement_due_fen:String(supplement),fee_allocation_version:1});
 d.order.supplement_due_fen=String(supplement);
 d.bill.refund_summary={obligation_fen:String(amount),refunded_fen:'0',pending_fen:'0',open_obligation_count:0,latest_refund:null};
 if (supplement > 0) {
  const p = { ...schema('PaymentView'), payment_id: nextId(s, 'supplement-payment'), order_id: d.order.order_id, supplement_id: nextId(s, 'supplement'), purpose: 'SUPPLEMENT', generation: 1, status: 'CREATED', amount_fen: String(supplement), business_amount_fen: String(supplement), channel_amount_fen: String(supplement), payer_total_fen: '0', version: '1', expires_at: new Date(time(s) + 5 * 60000).toISOString(), created_at: iso(s), paid_at: null, allowed_actions: [action('INVOKE_PAYMENT'), action('QUERY_PAYMENT')], blockers: [] };
  d.bill.supplement = { ...schema('SupplementView'), supplement_id: p.supplement_id, order_id: d.order.order_id, status: 'UNPAID', active_payment: p, paid_payment: null, amount_fen: p.amount_fen };
  transitionOrder(s, d, 6); return;
 }
 if (amount === 0) { transitionOrder(s, d, 8); return; }
 const refund = { ...schema('RefundView'), refund_id: nextId(s, 'refund'), order_id: d.order.order_id, original_payment_id: d.bill.initial_payment.payment_id, status: 'PROCESSING', amount_fen: String(amount), business_amount_fen: String(amount), channel_amount_fen: String(amount), deposit_component_fen: String(amount), payer_refund_fen: '0', refunded_at: null, version: '1', allowed_actions: [action('QUERY_REFUND')], blockers: [] };
 d.bill.refund_summary = { obligation_fen: String(amount), refunded_fen: '0', pending_fen: String(amount), open_obligation_count: 1, latest_refund: refund }; transitionOrder(s, d, 7);
}
export function previewDemoReview(s: DemoState, d: Row, input: Row): Row {
 requireRule(d.order.stage==='ACTIVE' && !d.bill.finalized,'当前订单不等待审核');
 const ret=s.returns[d.order.order_id];
 requireRule(['REVIEW_PENDING','MATERIAL_REQUIRED','APPROVE_FINAL'].includes(input.decision),'审核决定无效','VALIDATION_FAILED',422);
 requireRule(Array.isArray(input.loss_items)&&input.loss_items.length<=100&&Array.isArray(input.missing_items)&&input.missing_items.length<=20&&Array.isArray(input.evidence_ids),'审核材料格式无效','VALIDATION_FAILED',422);
 const reason=(value: unknown) => typeof value==='string' && value.trim().length>0 && [...value].length<=500;
 const evidence=(ids: unknown) => Array.isArray(ids) && ids.length<=20 && new Set(ids).size===ids.length && ids.every(id=>typeof id==='string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id) && s.materials[id]?.status==='READY' && ['EVIDENCE_IMAGE','EVIDENCE_VIDEO'].includes(s.materials[id]?.material_class));
 requireRule(evidence(input.evidence_ids),'审核凭证尚未就绪','VALIDATION_FAILED',422);
 if(ret) requireRule(input.receipt_version!=null && String(input.receipt_version)===String(ret.version),'归还记录已变化，请刷新','VERSION_CONFLICT',412);
 else requireRule(input.decision==='REVIEW_PENDING' && input.receipt_version==null,'归还记录不存在','RESOURCE_NOT_FOUND',404);
 requireRule(input.adjustment_reason==null || reason(input.adjustment_reason),'调整原因无效','VALIDATION_FAILED',422);
 requireRule(input.rejection_reason==null || reason(input.rejection_reason),'审核原因无效','VALIDATION_FAILED',422);
 requireRule(input.decision==='APPROVE_FINAL' ? input.rejection_reason==null && input.missing_items.length===0 : reason(input.rejection_reason),'请填写审核原因','VALIDATION_FAILED',422);
 requireRule(input.decision!=='MATERIAL_REQUIRED' || !!ret && input.missing_items.length>0,'请选择待补材料','VALIDATION_FAILED',422);
 const missingKeys=new Set<string>();
 for(const item of input.missing_items){const slot=ret?.evidence_slots.find((entry: Row)=>entry.slot.slot_key===item.slot_key),key=String(item.slot_key)+':'+String(item.item_no),current=slot?.items.find((entry: Row)=>entry.item_no===item.item_no);requireRule(slot && Number.isInteger(item.item_no) && item.item_no>=1 && item.item_no<=slot.slot.max_count && reason(item.reason) && !missingKeys.has(key) && (item.evidence_id==null || item.evidence_id===(current?.evidence_id??`${d.order.order_id}-${item.slot_key}-${item.item_no}`)),'待补材料与当前归还记录不一致','VALIDATION_FAILED',422);missingKeys.add(key);}
 let loss=0;
 for(const item of input.loss_items){requireRule(reason(item.description)&&evidence(item.evidence_ids),'损失说明或凭证无效','VALIDATION_FAILED',422);if(item.confirmed_fen==null)requireRule(input.decision!=='APPROVE_FINAL','最终审核须填写损失金额','VALIDATION_FAILED',422);else{const amount=quantity(String(item.confirmed_fen),'损失金额');requireRule(amount===0||item.evidence_ids.length>0,'有金额的损失项须提供凭证','VALIDATION_FAILED',422);loss+=amount;requireRule(Number.isSafeInteger(loss),'损失金额超出范围','VALIDATION_FAILED',422);}}
 const asset=s.supplies.find(v=>v.asset_id===d.order.asset.asset_id), pricing=d.demoPricing??{unit_seconds:asset?.rental_mode==='HOUR'?3600:86400,unit_price_fen:asset?.unit_price_fen,grace_seconds:3600};
 const price=quantity(String(pricing.unit_price_fen),'租金单价'), unit=Number(pricing.unit_seconds), grace=Number(pricing.grace_seconds);
 const end=Date.parse(d.order.rental_end_at), received=Date.parse(ret?.received_at??''), physicallyReceived=Number.isFinite(received)&&d.order.physical_status==='RECEIVED';
 requireRule(Number.isFinite(end) && [3600,86400].includes(unit) && Number.isSafeInteger(grace) && grace>=0 && grace<=86400,'演示计费依据不完整');
 const calculated=physicallyReceived?Math.max(0,Math.ceil((received-end-grace*1000)/(unit*1000)))*price:null;
 requireRule(calculated===null||Number.isSafeInteger(calculated),'演示费用超出可用范围','VALIDATION_FAILED',422);
 const deposit=quantity(String(d.bill.deposit_received_fen),'押金');
 const blockers: Row[]=[];if(!physicallyReceived)blockers.push({code:'RETURN_NOT_VERIFIED',message:'设备尚未可信收回'});if(!ret?.pre_return_complete||ret.material_status==='INCOMPLETE')blockers.push({code:'RETURN_MATERIAL_INCOMPLETE',message:'归还材料尚未齐全'});
 const base={basis_version:String(d.order.version),deposit_fen:String(deposit),overtime_fen:calculated===null?null:String(calculated),loss_fen:null,deducted_fen:null,refund_due_fen:null,supplement_due_fen:null,blockers};
 if(input.overtime_assessed_fen!=null){requireRule(calculated!==null,'尚未收回不能核定超期费用','VALIDATION_FAILED',422);const assessed=quantity(String(input.overtime_assessed_fen),'核定超期费');requireRule(assessed===calculated?input.adjustment_reason==null:reason(input.adjustment_reason),'核定超期费调整原因无效','VALIDATION_FAILED',422);}else requireRule(input.adjustment_reason==null,'未核定费用时不能填写调整原因','VALIDATION_FAILED',422);
 if(input.decision!=='APPROVE_FINAL')return base;
 requireRule(input.overtime_assessed_fen!==null && input.overtime_assessed_fen!==undefined,'请填写核定超期费','VALIDATION_FAILED',422);
 const assessed=quantity(String(input.overtime_assessed_fen),'核定超期费');
 const total=assessed+loss;requireRule(Number.isSafeInteger(total),'费用合计超出范围','VALIDATION_FAILED',422);
 return {...base,loss_fen:String(loss),...(blockers.length?{}:{deducted_fen:String(Math.min(deposit,total)),refund_due_fen:String(Math.max(0,deposit-total)),supplement_due_fen:String(Math.max(0,total-deposit))})};
}
export function rentalRoute(s: DemoState, method: string, path: string, q: Row, body: Row, ids: Row, headers: Row): Row | undefined {
 const r = rules(s);
 if (path === '/v1/me/rental-quotes') return quote(s, body);
 if (path === '/v1/me/rental-orders/preparations') {
  const quoted = quote(s, body);
  requireRule(body.accepted_terms_hash === quoted.terms_hash, '报价或选择已变化，请重新确认', 'QUOTE_CHANGED', 409);
  const asset = s.supplies.find(v => v.asset_id === body.asset_id)!;
  const d = makeOrder(0, 'TENANT', asset), id = nextId(s, 'order');
  Object.assign(d.order, { order_id: id, order_no: 'RO-' + id, rental_start_at: body.rental_start_at, rental_end_at: body.rental_end_at, created_at: iso(s), initial_due_fen: quoted.fees.initial_due_fen, payment_due_at: null });
  Object.assign(d, { contract_id: 'contract-' + id, fees: quoted.fees, requirements: quoted.requirements, demoPricing:{unit_seconds:asset.rental_mode==='HOUR'?3600:86400,unit_price_fen:asset.unit_price_fen,grace_seconds:3600}, selected_coupon_id: body.coupon_id ?? null, accepted_terms_hash: quoted.terms_hash, reservation_active: true, hold_expires_at: new Date(time(s) + 30 * 60000).toISOString(), payment_due_at: null });
  Object.assign(d.bill.initial_payment, { payment_id: 'payment-' + id, order_id: id, amount_fen: quoted.fees.initial_due_fen, business_amount_fen: quoted.fees.initial_due_fen, channel_amount_fen: quoted.fees.initial_due_fen, expires_at: null, paid_at: null, created_at: iso(s), supplement_id: null });
  const address = s.addresses.find(v => v.address_id === body.address_id);
  d.delivery = { ...d.delivery, method: body.delivery_method, recipient: address ? { recipient_name: address.recipient_name, country_code: address.phone_country_code, phone: address.phone, region_ids: [address.province_id, address.city_id, address.district_id], region_text: '广东省深圳市南山区', detail: address.detail_address, source_id: address.address_id } : null, tracking_no: null, carrier: null, shipped_at: null, delivered_at: null };
  if (body.coupon_id) r.couponReservations[body.coupon_id] = id;
  s.orders.unshift(d); return projectOrder(s, d);
 }
 if (path === '/v1/me/rental-orders') return list(s.orders.filter(v => (!q.role || v.order.viewer_role === q.role) && (!q.asset_id || v.order.asset.asset_id === q.asset_id) && (!q.display_status_code || v.order.display_status_code === q.display_status_code) && (!q.physical_status || v.order.physical_status === q.physical_status)).map(v => projectOrder(s, v).order), q);
 const d = ids.order_id ? s.orders.find(v => v.order.order_id === ids.order_id) : undefined;
 if (ids.order_id) requireRule(d, '订单不存在', 'RESOURCE_NOT_FOUND', 404);
 if (d) {
  const oid = d.order.order_id;
  if (path.endsWith('/' + oid)) return projectOrder(s, d);
  if (path.endsWith('/contract')) return undefined;
  const signature = path.includes('/contract/signature-attempts');
  if (method !== 'GET') {
   const aggregate = path.includes('/return/') ? returnFor(s, d) : d;
   if (!signature) checkVersion(aggregate, headers);
  }
  if (signature) {
   requireRule(d.order.stage === 'PREPARING', '当前订单不能继续签约');
   const old = s.signatures[oid];
   if (method === 'GET') return { state: old?.client_signature_id === ids.client_signature_id ? 'FOUND' : 'NOT_FOUND', attempt: old?.client_signature_id === ids.client_signature_id ? old : null };
   if (path.endsWith('/confirm')) {
    requireRule(old?.status === 'PREVIEW_READY' && old.client_signature_id === ids.client_signature_id && body.accepted === true && old.preview_artifact_id === body.preview_artifact_id && old.preview_sha256 === body.preview_sha256, '签名预览已变化或尚未同意');
    checkVersion(old, headers); old.status = 'CONFIRMED'; old.confirmed_at = iso(s); old.version = String(Number(old.version) + 1); d.order.version = String(Number(d.order.version) + 1); return old;
   }
   if (path.endsWith('/render-retry')) { requireRule(old && old.status !== 'CONFIRMED', '不能重试当前签名'); return old; }
   const material = s.materials[body.signature_material_id];
   requireRule(material?.status === 'READY' && material.material_class === 'CONTRACT_SIGNATURE_IMAGE', '请上传有效签名');
   requireRule(body.agreement_sha256 === 'a'.repeat(64) && body.order_terms_sha256 === (d.accepted_terms_hash ?? 'b'.repeat(64)), '合同条款已经变化', 'QUOTE_CHANGED');
   if (old) requireRule(body.replaces_attempt_id === old.attempt_id && body.replaces_attempt_version === old.version && old.status !== 'CONFIRMED', '已有签名，请明确替换原签名');
   const attempt = { ...schema('SignatureAttempt'), attempt_id: nextId(s, 'signature'), client_signature_id: body.client_signature_id, status: 'PREVIEW_READY', version: '1', preview_artifact_id: 'artifact-' + oid, preview_sha256: 'a'.repeat(64), expires_at: d.hold_expires_at, confirmed_at: null, error_code: null, allowed_actions: [action('CONFIRM_SIGNATURE'), action('REWRITE_SIGNATURE')] };
   s.signatures[oid] = attempt; return attempt;
  }
  if (path.endsWith('/confirm')) {
   requireRule(d.order.stage === 'PREPARING' && s.signatures[oid]?.status === 'CONFIRMED', '请先完成合同签名');
   entitlement(s, 'CONTRACT', -1, 'CONTRACT', oid);
   d.payment_due_at = new Date(time(s) + 5 * 60000).toISOString(); d.order.payment_due_at = d.payment_due_at; d.bill.initial_payment.expires_at = d.payment_due_at; return transitionOrder(s, d, 1);
  }
  if (path.endsWith('/cancel-unpaid')) { requireRule(['PREPARING', 'AWAITING_PAYMENT'].includes(d.order.stage), '当前订单不能按未支付取消'); d.close_reason = 'USER_CANCELLED'; closeOrder(s, d); return { state: 'APPLIED', resource_type: 'ORDER', resource_id: oid, version: d.order.version }; }
  if (path.endsWith('/payments')) {
   if (method === 'GET') return list([d.bill.initial_payment, d.bill.supplement?.active_payment, d.bill.supplement?.paid_payment].filter(Boolean), q);
   requireRule(d.order.viewer_role === 'TENANT', '出租方不能支付承租订单', 'FORBIDDEN', 403);
   requireRule(body.purpose === 'INITIAL' ? d.order.stage === 'AWAITING_PAYMENT' : body.purpose === 'SUPPLEMENT' && d.order.display_status_code === 'AWAITING_SUPPLEMENT', '当前订单不允许此类支付');
   const p = body.purpose === 'INITIAL' ? d.bill.initial_payment : d.bill.supplement.active_payment;
   requireRule(body.purpose !== 'SUPPLEMENT' || body.supplement_id === d.bill.supplement.supplement_id, '补缴单身份不一致'); return p;
  }
  if (path.endsWith('/shipment') || path.endsWith('/shipment/corrections')) {
   if (!path.includes('/return/')) { requireRule(d.order.viewer_role === 'LESSOR', '发货需由出租方操作；承租订单请使用演示中心模拟交付', 'FORBIDDEN', 403); requireRule(d.order.stage === 'ACTIVE' && ['AWAITING_DELIVERY', 'IN_USE'].includes(d.order.display_status_code), '当前不能发货'); requireRule(/^\S{1,64}$/.test(body.tracking_no ?? ''), '请填写有效运单号', 'VALIDATION_FAILED', 422); d.delivery.tracking_no = body.tracking_no; d.delivery.shipped_at = iso(s); return projectOrder(s, d); }
  }
  if (path.endsWith('/delivery-confirmations')) { requireRule(d.order.viewer_role === 'TENANT' && d.order.display_status_code === 'AWAITING_DELIVERY' && d.delivery.shipped_at, '请等待模拟发货后确认收货'); d.delivery.delivered_at = iso(s); return transitionOrder(s, d, 3); }
  if (path.endsWith('/pickup-credential')) { requireRule(d.delivery.method === 'CABINET' && d.order.stage === 'ACTIVE', '当前没有可用取件码'); return { order_id: oid, credential_id: 'pickup-' + oid, pickup_code: '123456', expires_at: d.order.rental_end_at }; }
  if (path.endsWith('/cabinet-options')) return { items: [1, 2, 3].map(n => ({ ...schema('CabinetOption'), cabinet_id: 'cabinet-' + n, name: '演示租赁柜 ' + n, cabinet_name: '演示租赁柜 ' + n, address: '科技园演示地址', connectivity_status: 'ONLINE', compartments: [{ compartment_id: 'slot-' + n, compartment_no: String(n), available: !slotBusy(s, 'cabinet-' + n, 'slot-' + n), blockers: [] }], available_compartments: slotBusy(s, 'cabinet-' + n, 'slot-' + n) ? [] : [{ compartment_id: 'slot-' + n, compartment_no: String(n) }] })), has_more: false, next_cursor: null, blockers: [] };
  if (path.endsWith('/cabinet-tasks')) {
   const ret = returnFor(s, d); refreshEvidence(ret);
   requireRule(d.order.viewer_role === 'TENANT' && d.order.display_status_code === 'RETURNING' && ret.method === 'CABINET' && ret.pre_return_complete, '请先发起柜机归还并补齐材料');
   requireRule(/^cabinet-[1-3]$/.test(body.cabinet_id) && body.compartment_id === 'slot-' + body.cabinet_id.slice(-1), '柜机或柜格不存在', 'RESOURCE_NOT_FOUND', 404);
   requireRule(!slotBusy(s, body.cabinet_id, body.compartment_id), '柜格已被占用');
   requireRule(!s.tasks.some(v => v.order_id === oid && ['RESERVED', 'AWAITING_CONFIRMATION'].includes(v.status)), '已有未结束柜机任务，请先完成或取消');
   const task = { ...schema('CabinetTask'), task_id: nextId(s, 'task'), order_id: oid, purpose: 'RETURN', cabinet_id: body.cabinet_id, compartment_id: body.compartment_id, cabinet_name: '演示租赁柜', compartment_no: body.compartment_id.slice(-1), status: 'RESERVED', door_status: 'CLOSED', hold_expires_at: new Date(time(s) + 10 * 60000).toISOString(), confirmed_at: null, version: '1', allowed_actions: ['OPEN_CABINET', 'CANCEL_CABINET', 'QUERY_CABINET'].map(action), blockers: [] };
   s.tasks.push(task); ret.cabinet_task = task; d.latest_cabinet_tasks = [task]; return task;
  }
  if (path.includes('/return')) {
   requireRule(d.order.stage === 'ACTIVE' || method === 'GET', '当前订单不允许归还');
   const ret = returnFor(s, d);
   if (path.endsWith('/return-draft')) { requireRule(d.order.viewer_role === 'TENANT' && d.order.display_status_code === 'IN_USE' && d.requirements.allowed_return_methods.includes(body.method), '请在租赁中选择允许的归还方式'); ret.method = body.method; ret.submitted_at = iso(s); transitionOrder(s, d, 4); }
   const supplementing=d.order.review_status==='MATERIAL_REQUIRED' && path.includes('/evidence-slots/');
   if (method !== 'GET' && !path.endsWith('/return-draft')) requireRule(d.order.display_status_code === 'RETURNING' || supplementing, '归还已进入审核或结束，不能继续修改');
   if (path.includes('/evidence-slots/')) {
    const slot = ret.evidence_slots.find((v: Row) => v.slot.slot_key === ids.slot_key), mat = s.materials[body.material_id], item = Number(ids.item_no);
    requireRule(slot && Number.isInteger(item) && item >= 1 && item <= slot.slot.max_count, '凭证槽位或序号无效', 'VALIDATION_FAILED', 422);
    if(supplementing)requireRule((ret.review_missing_items??[]).some((v: Row)=>v.slot_key===ids.slot_key&&v.item_no===item),'只能补交本次要求的材料');
    requireRule(mat?.status === 'READY' && mat.material_class === (slot.slot.kind === 'VIDEO' ? 'EVIDENCE_VIDEO' : 'EVIDENCE_IMAGE'), '凭证素材尚未就绪或用途不符');
    requireRule(!Object.entries(s.returns).some(([other, v]) => other !== oid && v.evidence_history.some((e: Row) => e.material_id === body.material_id)), '素材已用于另一笔订单');
    const existing = slot.items.find((v: Row) => v.item_no === item); requireRule(!existing || body.reason?.trim(), '替换凭证需要填写原因');
    slot.items = slot.items.filter((v: Row) => v.item_no !== item); slot.items.push({ evidence_id:nextId(s,'evidence'),slot_key:ids.slot_key,item_no: item, material_id: body.material_id, kind: slot.slot.kind, status: 'READY',availability:'READY',is_current:true,revision_no:Number(existing?.revision_no??0)+1,media: { ...media(body.material_id, mat.public_url), role: 'IMAGE' }, uploaded_at: iso(s), version: String(Number(existing?.version ?? 0) + 1) });
    ret.evidence_history.push({ slot_key: ids.slot_key, item_no: item, material_id: body.material_id, reason: body.reason ?? null, created_at: iso(s) });
    if(supplementing)ret.review_missing_items=(ret.review_missing_items??[]).filter((v: Row)=>v.slot_key!==ids.slot_key||v.item_no!==item);
   }
   if (path.endsWith('/address')) { const a = s.addresses.find(v => v.address_id === body.address_id); requireRule(a, '地址不存在'); ret.address = { recipient_name: a.recipient_name, phone: a.phone, country_code: a.phone_country_code, region_ids: [a.province_id, a.city_id, a.district_id], region_text: '广东省深圳市南山区', detail: a.detail_address, source_id: a.address_id }; ret.address_version = String(Number(ret.address_version) + 1); }
   refreshEvidence(ret);
   if(supplementing && ret.pre_return_complete){d.order.review_status='PENDING';d.order.version=String(Number(d.order.version)+1);ret.submitted_at=iso(s);}
   if (path.includes('/return/shipment')) { requireRule(ret.method === 'EXPRESS' && ret.pre_return_complete, '请补齐快递归还材料'); requireRule(body.confirmed_address_version === ret.address_version && /^\S{1,64}$/.test(body.tracking_no ?? ''), '归还地址版本或运单号无效', 'VALIDATION_FAILED', 422); ret.tracking_no = body.tracking_no; ret.carrier = body.carrier; ret.shipped_at = iso(s); }
   if (path.endsWith('/receipt')) { requireRule(d.order.viewer_role === 'LESSOR' && ret.shipped_at, '收件需由出租方确认；承租订单请使用演示中心模拟收件'); ret.received_at = iso(s); transitionOrder(s, d, 5); }
   if (method !== 'GET') ret.version = String(Number(ret.version) + 1);
   return ret.received_at && !ret.receipt_source ? {...ret,receipt_source:ret.method==='CABINET'?'CABINET':'OFFICIAL'} : ret;
  }
 }
 if (path === '/v1/me/cabinet-pickups') {
  const order = s.orders.find(v => v.delivery.method === 'CABINET' && v.order.display_status_code === 'AWAITING_DELIVERY' && v.order.viewer_role === 'TENANT');
  requireRule(order, '没有已付款待取件的柜机订单');
  const task = { ...schema('CabinetTask'), task_id: nextId(s, 'pickup'), order_id: order.order.order_id, purpose: 'PICKUP', cabinet_id: 'cabinet-1', compartment_id: 'slot-pickup-' + order.order.order_id, cabinet_name: '演示取件柜', compartment_no: '1', status: 'RESERVED', door_status: 'CLOSED', hold_expires_at: new Date(time(s) + 10 * 60000).toISOString(), version: '1', confirmed_at: null, allowed_actions: ['OPEN_CABINET', 'CANCEL_CABINET', 'QUERY_CABINET'].map(action), blockers: [] };
  requireRule(!s.tasks.some(v => v.order_id === task.order_id && ['RESERVED', 'AWAITING_CONFIRMATION'].includes(v.status)), '已有未结束取件任务');
  s.tasks.push(task); return task;
 }
 if (ids.task_id) {
  const task = s.tasks.find(v => v.task_id === ids.task_id); requireRule(task, '柜机任务不存在', 'RESOURCE_NOT_FOUND', 404);
  const order = s.orders.find(v => v.order.order_id === task.order_id)!;
  if (method !== 'GET') checkVersion(task, headers);
  if (Date.parse(task.hold_expires_at) <= time(s) && ['RESERVED', 'AWAITING_CONFIRMATION'].includes(task.status)) { task.status = 'CANCELLED'; task.allowed_actions = [action('QUERY_CABINET')]; }
  if (path.endsWith('/open')) {
   requireRule(task.status === 'RESERVED', '当前任务不能开柜');
   task.status = task.purpose === 'RETURN' ? 'AWAITING_CONFIRMATION' : 'SUCCEEDED'; task.door_status = 'CLOSED'; task.version = String(Number(task.version) + 1);
   task.allowed_actions = (task.purpose === 'RETURN' ? ['CONFIRM_RETURN', 'CANCEL_CABINET', 'QUERY_CABINET'] : ['QUERY_CABINET']).map(action);
   if (task.purpose === 'PICKUP') { task.occupancy_result = 'TARGET_ABSENT'; task.rfid_result = 'NOT_OBSERVED'; task.pre_open_rfid_result = 'MATCH'; task.observed_at = iso(s); transitionOrder(s, order, 3); }
  }
  if (path.endsWith('/confirm-return')) { requireRule(task.purpose === 'RETURN' && task.status === 'AWAITING_CONFIRMATION', '请先完成开柜放入设备'); task.status = 'SUCCEEDED'; task.confirmed_at = iso(s); task.version = String(Number(task.version) + 1); task.allowed_actions = [action('QUERY_CABINET')]; returnFor(s, order).received_at = iso(s); transitionOrder(s, order, 5); }
  if (path.endsWith('/cancel')) { requireRule(['RESERVED', 'AWAITING_CONFIRMATION'].includes(task.status), '当前任务不能取消'); task.status = 'CANCELLED'; task.version = String(Number(task.version) + 1); task.allowed_actions = [action('QUERY_CABINET')]; }
  if (path.endsWith('/reconciliation')) return { state: ['SUCCEEDED', 'CANCELLED'].includes(task.status) ? 'APPLIED' : 'ACCEPTED', resource_type: 'CABINET_TASK', resource_id: task.task_id, version: task.version };
  return task;
 }
 if (ids.payment_id) {
  const { d: order, p } = paymentFor(s, ids.payment_id);
  if (method !== 'GET') checkVersion(p, headers);
  if (path.endsWith('/invocation')) { requireRule(['CREATED', 'FAILED_CONFIRMED'].includes(p.status) && Date.parse(p.expires_at) > time(s), '支付单不可支付或已过期'); return { ...schema('Invocation'), payment_id: p.payment_id, expires_at: p.expires_at, time_stamp: String(Math.floor(time(s) / 1000)), app_id: r.appId ?? '', nonce_str: 'offline-demo', package: 'prepay_id=offline-demo-' + p.payment_id, sign_type: 'RSA', pay_sign: 'OFFLINE_DEMO_NO_REAL_PAYMENT' }; }
  if (path.endsWith('/reconciliation')) {
   if (p.status === 'SUCCEEDED') return { state: 'APPLIED', resource_type: 'ORDER', resource_id: order.order.order_id, version: p.version };
   const outcome = r.paymentResults[p.payment_id];
   if (outcome === 'FAILED' || outcome === 'CANCELLED') { p.status = 'CREATED'; p.last_verified_at = iso(s); }
   if (outcome === 'SUCCESS' && p.status !== 'CLOSED_UNPAID') {
    Object.assign(p, { status: 'SUCCEEDED', paid_at: iso(s), payer_total_fen: p.amount_fen, last_verified_at: iso(s), version: String(Number(p.version) + 1) });
    if (p.purpose === 'INITIAL') {
     const cid = order.selected_coupon_id, c = s.coupons.find(v => v.coupon_id === cid);
     if (c) { c.status = 'REDEEMED'; c.version = String(Number(c.version) + 1); delete r.couponReservations[cid]; }
     transitionOrder(s, order, 2);
    } else { order.bill.supplement.paid_payment=clone(p);order.bill.supplement.active_payment=null;order.bill.supplement.status='PAID';order.bill.supplement_due_fen='0';order.order.supplement_due_fen='0';order.bill.refund_due_fen='0';order.bill.refund_summary={obligation_fen:'0',refunded_fen:'0',pending_fen:'0',open_obligation_count:0,latest_refund:null};transitionOrder(s,order,8); }
   }
   finance(order); return { state: ['SUCCEEDED', 'CLOSED_UNPAID'].includes(p.status) ? 'APPLIED' : 'ACCEPTED', resource_type: 'ORDER', resource_id: order.order.order_id, version: p.version, poll_after_seconds: 0 };
  }
  return p;
 }
 if (ids.refund_id) {
  const order = s.orders.find(v => v.bill.refund_summary.latest_refund?.refund_id === ids.refund_id); requireRule(order, '退款单不存在', 'RESOURCE_NOT_FOUND', 404);
  const refund = order.bill.refund_summary.latest_refund;
  if (method === 'POST') { checkVersion(refund, headers); if (r.refundResults?.[refund.refund_id] === 'SUCCESS' && refund.status !== 'SUCCEEDED') { refund.status = 'SUCCEEDED'; refund.refunded_at = iso(s); refund.payer_refund_fen = refund.amount_fen; refund.version = String(Number(refund.version) + 1); order.bill.deposit_refunded_fen = refund.amount_fen; Object.assign(order.bill.refund_summary, { refunded_fen: refund.amount_fen, pending_fen: '0', open_obligation_count: 0 }); transitionOrder(s, order, 8); } return { state: refund.status === 'SUCCEEDED' ? 'APPLIED' : 'ACCEPTED', resource_type: 'ORDER', resource_id: order.order.order_id, version: refund.version }; }
  return refund;
 }
 return undefined;
}
function slotBusy(s: DemoState, cabinet: string, slot: string): boolean {
 return s.tasks.some(v => v.cabinet_id === cabinet && v.compartment_id === slot && ['RESERVED', 'AWAITING_CONFIRMATION'].includes(v.status) && Date.parse(v.hold_expires_at) > time(s));
}

/** Explicit stand-ins for lessor/platform/provider events, exposed only by the demo center. */
export function externalEvent(s: DemoState, id: string, event: string): Row {
 const d = s.orders.find(v => v.order.order_id === id); requireRule(d, '订单不存在', 'RESOURCE_NOT_FOUND', 404);
 if (event === 'DELIVER') { requireRule(d.order.display_status_code === 'AWAITING_DELIVERY', '当前订单不等待交付'); d.delivery.shipped_at = iso(s); d.delivery.delivered_at = iso(s); return transitionOrder(s, d, 3); }
 if (event === 'RECEIVE') { const ret = returnFor(s, d); requireRule(d.order.display_status_code === 'RETURNING' && ret.method === 'EXPRESS' && ret.shipped_at && ret.pre_return_complete, '请先补齐归还凭证并提交快递运单'); ret.received_at = iso(s); return transitionOrder(s, d, 5); }
 if (event === 'REVIEW' || event === 'REVIEW_SUPPLEMENT') { requireRule(d.order.display_status_code === 'RETURN_REVIEW', '当前订单不等待审核'); beginRefund(s,d,event==='REVIEW_SUPPLEMENT'?Number(d.bill.deposit_received_fen)+6000:0); return d; }
 if (event === 'REFUND_SUCCESS') { const refund = d.bill.refund_summary.latest_refund; requireRule(d.order.display_status_code === 'REFUND_PROCESSING' && refund, '当前没有待退款订单'); rules(s).refundResults ??= {}; rules(s).refundResults[refund.refund_id] = 'SUCCESS'; return refund; }
 throw new Error('未知模拟事件');
}
