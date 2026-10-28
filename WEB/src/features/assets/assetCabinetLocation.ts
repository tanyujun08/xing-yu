import type { CabinetManagementGateway } from '../../shared/services/cabinetManagement';
import type { Asset } from '../../shared/services/contracts';

export interface AssetCabinetDirectory {
  cabinets: { id: string; name: string }[];
  locations: Record<string, { address: string; cabinetBox: string }>;
}

export function unplacedAssetLocation(asset: Pick<Asset, 'availabilityStatus'>): string {
  return asset.availabilityStatus === 'RENTING' ? '租客使用中' : '待投放';
}

export async function readAssetCabinetDirectory(
  gateway: CabinetManagementGateway,
  assets: readonly Asset[],
  signal?: AbortSignal,
): Promise<AssetCabinetDirectory> {
  const context = signal === undefined ? undefined : { signal };
  const cabinets = [] as Awaited<ReturnType<CabinetManagementGateway['get']>>[];
  let cursor = '';
  do {
    const page = await gateway.list({ cursor }, context);
    cabinets.push(...page.items);
    cursor = page.page.has_more ? page.page.next_cursor ?? '' : '';
    if (page.page.has_more && cursor === '') throw new Error('柜机分页游标缺失');
  } while (cursor !== '');
  const byId = new Map(cabinets.map((cabinet) => [cabinet.cabinet_id, cabinet]));
  const placed = assets.filter((asset) => asset.supplyMode === 'OFFICIAL' && asset.boxId !== null);
  for (const asset of placed) if (!asset.cabinetId || !byId.has(asset.cabinetId)) throw new Error('资产当前柜机不可读取');
  const slotGroups = await Promise.all([...new Set(placed.map((asset) => asset.cabinetId!))].map(async (cabinetId) => ({ cabinetId, slots: (await gateway.compartments(cabinetId, context)).items })));
  const slotsByCabinet = new Map(slotGroups.map((group) => [group.cabinetId, group.slots]));
  const locations: AssetCabinetDirectory['locations'] = {};
  for (const asset of placed) {
    const cabinet = byId.get(asset.cabinetId!)!;
    const slot = slotsByCabinet.get(asset.cabinetId!)?.find((item) => item.compartment_id === asset.boxId && item.cabinet_id === asset.cabinetId);
    if (!slot) throw new Error('在柜位置与柜机格口不一致');
    locations[asset.id] = { address: cabinet.deployment_site_address ?? '商家经营地址未配置', cabinetBox: `${cabinet.cabinet_name} · ${slot.compartment_no} 号格口` };
  }
  return { cabinets: cabinets.map((cabinet) => ({ id: cabinet.cabinet_id, name: cabinet.cabinet_name })), locations };
}

export async function readAssetCabinetLocation(
  gateway: CabinetManagementGateway,
  cabinetId: string,
  compartmentId: string,
  signal?: AbortSignal,
): Promise<{ address: string; cabinetBox: string }> {
  const context = signal === undefined ? undefined : { signal };
  const [cabinet, compartments] = await Promise.all([
    gateway.get(cabinetId, context),
    gateway.compartments(cabinetId, context),
  ]);
  const slot = compartments.items.find((item) => item.compartment_id === compartmentId && item.cabinet_id === cabinetId);
  if (cabinet.cabinet_id !== cabinetId || !slot) throw new Error('在柜位置与柜机格口不一致');
  return {
    address: cabinet.deployment_site_address ?? '商家经营地址未配置',
    cabinetBox: `${cabinet.cabinet_name} · ${slot.compartment_no} 号格口`,
  };
}
