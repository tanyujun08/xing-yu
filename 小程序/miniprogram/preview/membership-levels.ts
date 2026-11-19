import { displayGrowthUnits } from '../shared/presentation/api-points';

// The HTML prototype uses displayed 星光, while the demo ledger stores tenths.
const tiers = [
  { key: 'bronze', name: '青铜', english: 'BRONZE', minimum: 0, perks: 2, levelArtHasStand: true },
  { key: 'silver', name: '白银', english: 'SILVER', minimum: 5000, perks: 4, levelArtHasStand: true },
  { key: 'gold', name: '黄金', english: 'GOLD', minimum: 10000, perks: 6, levelArtHasStand: true },
  { key: 'platinum', name: '铂金', english: 'PLATINUM', minimum: 20000, perks: 8, levelArtHasStand: true },
  { key: 'diamond', name: '钻石', english: 'DIAMOND', minimum: 30000, perks: 10, levelArtHasStand: false },
  { key: 'stellar', name: '星耀', english: 'STELLAR', minimum: 50000, perks: 12, levelArtHasStand: false },
  { key: 'royal', name: '王者', english: 'ROYAL', minimum: 80000, perks: 14, levelArtHasStand: false },
] as const;

function levelVisual(tier: (typeof tiers)[number]) {
  const folder = tier.levelArtHasStand ? 'levels/' : '';
  return {
    key: tier.key,
    src: '/assets/membership/' + folder + tier.key + '.png',
    showStand: !tier.levelArtHasStand,
  };
}

export function groupMemberNumber(value: string): string {
  const [whole = '', fraction] = value.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? '.' + fraction : '');
}

export function offlineMembershipLevel(growthUnits: string) {
  const scaled = Number(growthUnits);
  const index = tiers.reduce((current, tier, i) => scaled >= tier.minimum * 10 ? i : current, 0);
  const tier = tiers[index]!;
  const next = tiers[index + 1];
  const remaining = next ? next.minimum * 10 - scaled : 0;
  const remainingPoints = groupMemberNumber(displayGrowthUnits(String(remaining)));
  return {
    tierKey: tier.key,
    level: tier.name + '会员',
    levelEnglish: tier.english + ' MEMBER',
    art: '/assets/membership/' + tier.key + '.png',
    starPoints: groupMemberNumber(displayGrowthUnits(growthUnits)),
    nextLevel: next?.name ?? '',
    nextArt: next ? '/assets/membership/' + next.key + '.png' : '',
    hasNextLevel: Boolean(next),
    atMaxLevel: !next,
    currentThreshold: groupMemberNumber(String(tier.minimum)),
    currentLevelName: tier.name,
    nextThreshold: next ? groupMemberNumber(String(next.minimum)) : '',
    remainingPoints,
    rightsCaption: next
      ? `当前 ${tier.perks} 项权益 · ${next.name} ${next.perks} 项`
      : `${tier.name}会员可享 ${tier.perks} 项专属权益`,
    heroVisual: levelVisual(tier),
    panelVisual: levelVisual(next ?? tier),
    railProgress: index / (tiers.length - 1) * 100,
    progress: next ? (scaled - tier.minimum * 10) / ((next.minimum - tier.minimum) * 10) * 100 : 100,
    levels: tiers.map((entry, i) => ({
      key: entry.key, name: entry.name, threshold: groupMemberNumber(String(entry.minimum)),
      state: i < index ? 'passed' : i === index ? 'current' : 'locked',
      next: i === index + 1,
      statusLabel: i < index ? '已达成' : i === index ? '当前等级' : i === index + 1 ? '还需 ' + remainingPoints : '—',
    })),
  };
}

export function offlineMembershipEntitlements(rows: readonly {kind: string; available_qty: string; expiry_pending?: boolean}[]) {
  return rows.filter(row => row.kind === 'PUBLISH_QUOTA' || row.kind === 'CONTRACT').map(row => ({
    id: row.kind,
    label: row.kind === 'CONTRACT' ? '电子合同' : '出租发布额度',
    value: row.expiry_pending ? '待刷新' : '剩余 ' + groupMemberNumber(row.available_qty) + ' 次',
  }));
}
