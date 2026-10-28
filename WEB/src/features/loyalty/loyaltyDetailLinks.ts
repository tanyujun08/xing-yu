import type { LoyaltyDetailKind } from '../../shared/services/loyaltyManagement';

export function loyaltyDetailHref(kind: LoyaltyDetailKind, id: string, pathname = '/settings/coupons') {
  return `${pathname}?${new URLSearchParams({ detail_kind: kind, detail_id: id })}`;
}
