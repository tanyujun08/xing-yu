import type { components } from '../model/contract-signature';
import { beijingTime, rentalActionAllowed } from './rental-order';
import { signatureStatus, signatureUnavailable, validContractArtifact } from './contract-signature';
type RentalContract = components['schemas']['ContractView'];
type RentalOrder = components['schemas']['OrderDetail'];

/** A local deadline only blocks continuation; CLOSED remains a server fact. */
export function rentalOrderPreparation(value: RentalOrder, contract: RentalContract | null = null, now = Date.now()) {
    if (value.order.stage !== 'PREPARING') return null;
    const matches = !!contract && contract.order_id === value.order.order_id && contract.contract_id === value.contract_id;
    const signed = matches && contract.status === 'SUCCEEDED' && contract.tenant_signature.status === 'SUCCEEDED'
        && !!contract.tenant_signature.signed_at && Number.isFinite(Date.parse(contract.tenant_signature.signed_at))
        && !!contract.final_artifact && validContractArtifact(contract.final_artifact);
    const pending = matches && contract.status === 'PENDING' && contract.tenant_signature.status === 'PENDING' && !signatureUnavailable(contract);
    const deadline = Math.min(Date.parse(value.hold_expires_at), matches ? Date.parse(contract.expires_at) : NaN);
    const expired = !Number.isFinite(deadline) || deadline <= now;
    const tenant = value.order.viewer_role === 'TENANT';
    const canConfirm = tenant && signed && !expired && rentalActionAllowed(value.order.allowed_actions, 'CONFIRM_ORDER');
    const canSign = tenant && pending && !contract.current_attempt && !expired && rentalActionAllowed(value.order.allowed_actions, 'SIGN_CONTRACT');
    const resume = pending && !!contract.current_attempt;
    const canResume = tenant && resume && !expired && rentalActionAllowed(value.order.allowed_actions, 'VIEW_CONTRACT');
    const signature = matches ? signatureStatus(contract, false) : null;
    return {
        signed, expired, canConfirm, canSign, canCancel: tenant && rentalActionAllowed(value.order.allowed_actions, 'CANCEL_UNPAID'),
        title: expired ? '订单状态待核实' : signed ? '合同已签署' : resume ? signature!.title : pending ? '待签署合同' : '合同状态待核实',
        hint: expired ? Number.isFinite(deadline) ? '准备期限已到，请刷新核实订单结果。' : '准备期限尚未核实，请刷新订单状态。' : signed ? tenant ? value.fees.initial_due_fen === '0' ? '下一步：确认订单，无需付款' : '下一步：确认订单并付款' : '等待承租人确认订单' : resume ? signature!.hint : pending ? tenant ? '请先阅读合同并签署本人姓名' : '等待承租人签署合同' : '请刷新订单，核实原合同状态。',
        signedAt: signed ? beijingTime(contract.tenant_signature.signed_at) : '',
        expiresAt: Number.isFinite(deadline) ? new Date(deadline).toISOString() : '',
        deadline: Number.isFinite(deadline) ? beijingTime(new Date(deadline).toISOString()) : '待核实',
        primaryCode: canConfirm ? 'CONFIRM_ORDER' : canResume ? 'VIEW_CONTRACT' : canSign ? 'SIGN_CONTRACT' : '',
        primaryLabel: canConfirm ? value.fees.initial_due_fen === '0' ? '确认订单，无需付款' : '确认订单并付款' : canResume ? '查看签署进度' : canSign ? '阅读并签署合同' : '刷新订单状态',
    };
}
