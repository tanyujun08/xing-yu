import type { components } from '../model/contract-signature';
import { isPublicMaterialURL } from './material-media';
type S = components['schemas'];
export function validSignatureImage(image: S['SignatureImage'] | null | undefined): image is S['SignatureImage'] {
    return !!image && !!image.material_id && /^[a-f0-9]{64}$/.test(image.sha256) && isPublicMaterialURL(image.url);
}
export function signatureUnavailable(contract: S['ContractView']): boolean {
    return contract.status === 'EXPIRED' || contract.current_attempt?.status === 'EXPIRED' || contract.blockers.some(b => b.code === 'CONTRACT_EXPIRED');
}
export function validContractArtifact(artifact: S['ContractArtifact']): boolean {
    return !!artifact && !!artifact.artifact_id && /^[a-f0-9]{64}$/.test(artifact.document_sha256) && isPublicMaterialURL(artifact.document_url)
        && Number.isInteger(artifact.page_count) && artifact.page_count >= 1 && artifact.page_count <= 64 && artifact.pages.length === artifact.page_count
        && artifact.pages.every((p, i) => p.page_no === i + 1 && !!p.material_id && /^[a-f0-9]{64}$/.test(p.sha256) && isPublicMaterialURL(p.url))
        && artifact.anchor_snapshot_json.length === 1 && artifact.anchor_snapshot_json.every(a => a.role === 'TENANT_MAIN' && Number.isInteger(a.page_no) && a.page_no >= 1 && a.page_no <= artifact.page_count && [a.x, a.y, a.w, a.h].every(Number.isFinite) && a.x >= 0 && a.y >= 0 && a.w > 0 && a.h > 0 && a.x + a.w <= 1 && a.y + a.h <= 1);
}
export function signatureStatus(contract: S['ContractView'], unresolved: boolean) {
    if (contract.status === 'SUCCEEDED') return { title: '合同已签署', hint: '已保存完整合同，可查看或下载。', tone: 'success' };
    if (contract.status === 'EXPIRED' || contract.current_attempt?.status === 'EXPIRED') return { title: '签署已过期', hint: '本次签约已不可继续，请返回订单查看最新状态。', tone: 'neutral' };
    if (signatureUnavailable(contract)) return { title: '本次签约不可继续', hint: '请返回订单核实最新状态，不能继续上传、签名或确认。', tone: 'neutral' };
    if (unresolved) return { title: '签署结果待核实', hint: '请先查询原请求，核实前不要重新签名。', tone: 'neutral' };
    switch (contract.current_attempt?.status) {
        case 'BUILDING': return { title: '正在生成合同', hint: '签名已提交，正在合成完整合同。生成完成后请核对并确认。', tone: 'neutral' };
        case 'PREVIEW_READY': return { title: '核对签名位置后确认', hint: '预览不代表已完成签署，请核对完整合同。', tone: 'success' };
        case 'RENDER_FAILED': return { title: '签名已保存，合同暂未生成', hint: '无需重新签名，生成并确认合同后才完成签署。', tone: 'success' };
        default: return { title: '待我签署', hint: '请在准备期限内完成签署并确认订单。', tone: 'success' };
    }
}
