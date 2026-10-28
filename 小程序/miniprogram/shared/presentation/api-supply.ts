interface SupplyCardInput {
  asset_id: string; display_name: string; supply_type: 'CABINET' | 'STORE' | 'PERSONAL'; rental_mode: 'DAY' | 'HOUR';
  unit_price_fen: string; deposit_fen: string; region: { city_name: string; district_name?: string } | null; delivery_methods?: string[];
}
import type { PublicMaterialMedia } from '../model/material-media';
import { publicMedia, publicMediaGallery } from './material-media';
import { formatCNYMinorUnits } from '../format/money';
export const supplySourceLabels = { CABINET: '自助柜', STORE: '门店', PERSONAL: '个人' } as const;
export const deliveryLabels: Record<string, string> = { CABINET: '柜取柜还', STORE: '门店自提', MEET: '面交', EXPRESS: '快递', RUNNER: '跑腿' };
export function supplyCard(item: SupplyCardInput, width = 430, fontSize = 16, coverUrl = '') {
  const price = formatCNYMinorUnits(item.unit_price_fen).slice(1), deposit = formatCNYMinorUnits(item.deposit_fen).slice(1);
  return { id: item.asset_id, name: item.display_name, supplyType: item.supply_type.toLowerCase(), location: item.region ? item.region.city_name + (item.region.district_name ?? '') : '位置暂未提供',
    deposit, homeImage: coverUrl, homeSourceLabel: supplySourceLabels[item.supply_type], homePrice: price, homePriceUnit: item.rental_mode === 'HOUR' ? '/小时' : '/天',
    homeSummary: (item.delivery_methods ?? []).map(method => deliveryLabels[method] ?? method).join(' · '),
    homeLayout: price.length > 9 || deposit.length > 11 || fontSize > 24 ? 'long-amount' : width >= 390 && fontSize <= 20 && price.length <= 6 && deposit.length <= 7 ? 'wide' : 'narrow' };
}
export const MAX_DETAIL_MEDIA = 9;
export function publicSupplyGallery(supply: {media: PublicMaterialMedia[]}): {src:string}[] {
  return publicMediaGallery(supply.media,MAX_DETAIL_MEDIA);
}

export function publicSupplyVideo(supply: {media:PublicMaterialMedia[]}, materialId: string) {
  const value=supply.media.find(item=>item.role==='VIDEO'&&item.material_id===materialId);
  return value?publicMedia(value):null;
}
