import { expect, test } from 'vitest';
import type { RentalOrder, RentalContract } from '../miniprogram/shared/api/rental-api';
import { rentalOrderPreparation } from '../miniprogram/shared/presentation/rental-order-preparation';

const now = Date.parse('2026-10-10T00:00:00Z');
const action = (action_code: string) => ({ action_code, allowed: true });
function order() { return { order: { order_id: 'o1', stage: 'PREPARING', viewer_role: 'TENANT', allowed_actions: ['CONFIRM_ORDER', 'SIGN_CONTRACT', 'VIEW_CONTRACT'].map(action) }, contract_id: 'c1', hold_expires_at: '2026-10-10T00:30:00Z', fees: { initial_due_fen: '80000' } } as RentalOrder; }
function contract() { return { order_id: 'o1', contract_id: 'c1', expires_at: '2026-10-10T01:00:00Z', status: 'SUCCEEDED', tenant_signature: { status: 'SUCCEEDED', signed_at: '2026-10-10T00:01:00Z' }, current_attempt: null, blockers: [], final_artifact: { artifact_id: 'a1', document_sha256: 'a'.repeat(64), document_url: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/test/a.pdf', page_count: 1, pages: [{ page_no: 1, material_id: 'm1', sha256: 'b'.repeat(64), url: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/test/a.png' }], anchor_snapshot_json: [{ role: 'TENANT_MAIN', page_no: 1, x: 0, y: 0, w: .5, h: .5 }] } } as unknown as RentalContract; }

test('signed detail uses verified same-order contract, amount and server permission', () => {
    const o = order();
    expect(rentalOrderPreparation(o, contract(), now)).toMatchObject({ title: '合同已签署', canConfirm: true, canSign: false, primaryCode: 'CONFIRM_ORDER', primaryLabel: '确认订单并付款' });
    o.fees.initial_due_fen = '0'; expect(rentalOrderPreparation(o, contract(), now)?.primaryLabel).toBe('确认订单，无需付款');
    o.order.viewer_role = 'LESSOR'; expect(rentalOrderPreparation(o, contract(), now)?.canConfirm).toBe(false);
    o.order.viewer_role = 'TENANT'; o.order.allowed_actions = []; expect(rentalOrderPreparation(o, contract(), now)?.canConfirm).toBe(false);
});
test('local deadline blocks continuation without claiming server closure or unsigned contract', () => {
    const o = order(); o.hold_expires_at = '2026-10-09T00:00:00Z';
    expect(rentalOrderPreparation(o, contract(), now)).toMatchObject({ title: '订单状态待核实', signed: true, expired: true, primaryCode: '', canConfirm: false });
    expect(o.order.stage).toBe('PREPARING'); o.order.stage = 'CLOSED'; expect(rentalOrderPreparation(o, contract(), now)).toBeNull();
});
test.each(['missing', 'other-order', 'other-contract', 'bad-artifact', 'missing-time'])('unverified signed evidence fails closed: %s', reason => {
    const c = contract(); if (reason === 'other-order') c.order_id = 'other'; if (reason === 'other-contract') c.contract_id = 'other'; if (reason === 'bad-artifact') c.final_artifact!.document_sha256 = 'bad'; if (reason === 'missing-time') c.tenant_signature.signed_at = null;
    expect(rentalOrderPreparation(order(), reason === 'missing' ? null : c, now)).toMatchObject({ signed: false, canConfirm: false, canSign: false, primaryCode: '' });
});
test.each(['BUILDING', 'PREVIEW_READY', 'RENDER_FAILED'] as const)('existing signature %s returns to original contract instead of starting a new signature', status => {
    const c = contract(); c.status = 'PENDING'; c.tenant_signature.status = 'PENDING'; c.final_artifact = null; c.current_attempt = { attempt_id: 'original', status } as RentalContract['current_attempt'];
    expect(rentalOrderPreparation(order(), c, now)).toMatchObject({ signed: false, canSign: false, canConfirm: false, primaryCode: 'VIEW_CONTRACT', primaryLabel: '查看签署进度' });
});
test('unsigned contract requires a server allowed signature action', () => {
    const o = order(), c = contract(); c.status = 'PENDING'; c.tenant_signature.status = 'PENDING'; c.final_artifact = null;
    expect(rentalOrderPreparation(o, c, now)).toMatchObject({ canSign: true, primaryCode: 'SIGN_CONTRACT' });
    o.order.allowed_actions = []; expect(rentalOrderPreparation(o, c, now)?.canSign).toBe(false);
});
test.each(['2026-10-09T23:59:00Z', 'invalid', ''])('contract deadline %s blocks continuation even with a live order hold', expires_at => {
    const c = contract(); c.expires_at = expires_at;
    expect(rentalOrderPreparation(order(), c, now)).toMatchObject({ signed: true, expired: true, canConfirm: false, canSign: false, primaryCode: '' });
});
test('preparation displays the earliest verified order or contract deadline', () => {
    const c = contract(); c.expires_at = '2026-10-10T00:15:00Z';
    expect(rentalOrderPreparation(order(), c, now)).toMatchObject({ canConfirm: true, expiresAt: '2026-10-10T00:15:00.000Z', deadline: '2026-10-10 08:15' });
    c.expires_at = '2026-10-10T01:00:00Z';
    expect(rentalOrderPreparation(order(), c, now)?.expiresAt).toBe('2026-10-10T00:30:00.000Z');
});
