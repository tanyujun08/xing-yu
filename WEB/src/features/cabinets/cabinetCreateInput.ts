import type { CabinetCreate } from '../../shared/services/cabinetManagement';

export function cabinetCreateInput(fields: { device: string; name: string; description: string; count: number; reason: string; merchantId: string }): CabinetCreate {
  if (fields.merchantId === '') throw new Error('请选择所属商家并核对经营地址');
  return {
    provider_device_id: fields.device, cabinet_name: fields.name.trim(), description: fields.description.trim() || null,
    compartment_count: fields.count, reason: fields.reason.trim(), merchant_id: fields.merchantId,
  };
}
