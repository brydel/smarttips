import type {
  TipDistribution,
  DistributionSummary,
  RoleAggregate,
  DistributionRole,
} from '../types/distribution.types';

export const ROLE_META: Record<DistributionRole, { label: string; color: string; icon: string }> = {
  SERVER: { label: 'Serveur·euse', color: '#818CF8', icon: '◆' },
  BARTENDER: { label: 'Barman·aid', color: '#E8C49A', icon: '◐' },
  BUSSER: { label: 'Runner', color: '#8892B0', icon: '◇' },
  HOST: { label: 'Accueil', color: '#34D399', icon: '◉' },
  COOK: { label: 'Cuisinier', color: '#BCB19A', icon: '▣' },
  CHEF: { label: 'Chef', color: '#F87171', icon: '★' },
};

/** Safe string-to-number parse (returns 0 on failure). */
export function toNum(value: string | number | undefined | null): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return isFinite(n) ? n : 0;
}

/** Compute summary stats from distributions array. */
export function computeSummary(distributions: TipDistribution[]): DistributionSummary {
  if (distributions.length === 0) {
    return {
      poolTotal: 0,
      employeeCount: 0,
      avgAmount: 0,
      maxAmount: 0,
      minAmount: 0,
      totalScore: 0,
      computationMethod: '',
    };
  }

  const amounts = distributions.map((d) => toNum(d.amount));
  const scores = distributions.map((d) => toNum(d.explanation.rawScore ?? d.contributionScore));

  const poolTotal = amounts.reduce((s, a) => s + a, 0);
  const totalScore = scores.reduce((s, a) => s + a, 0);

  return {
    poolTotal,
    employeeCount: distributions.length,
    avgAmount: poolTotal / distributions.length,
    maxAmount: Math.max(...amounts),
    minAmount: Math.min(...amounts),
    totalScore,
    computationMethod: distributions[0]?.computationMethod ?? 'RULES',
  };
}

/** Compute per-role aggregates for the donut chart. */
export function computeRoleAggregates(
  distributions: TipDistribution[],
  poolTotal: number,
): RoleAggregate[] {
  const map = new Map<DistributionRole, RoleAggregate>();

  for (const dist of distributions) {
    const role = dist.employee.role;
    const meta = ROLE_META[role] ?? { label: role, color: '#8892B0', icon: '●' };
    const amount = toNum(dist.amount);

    const existing = map.get(role);
    if (existing) {
      existing.amount += amount;
      existing.headcount += 1;
    } else {
      map.set(role, {
        role,
        label: meta.label,
        color: meta.color,
        amount,
        headcount: 1,
        share: 0,
      });
    }
  }

  const aggregates = Array.from(map.values()).sort((a, b) => b.amount - a.amount);

  // Compute shares
  for (const agg of aggregates) {
    agg.share = poolTotal > 0 ? agg.amount / poolTotal : 0;
  }

  return aggregates;
}

/** Get the initial angle offset for each donut slice. */
export interface DonutSlice {
  role: DistributionRole;
  label: string;
  color: string;
  amount: number;
  headcount: number;
  share: number;
  startAngle: number; // radians, starting from top (−π/2)
  endAngle: number;
}

export function computeDonutSlices(aggregates: RoleAggregate[]): DonutSlice[] {
  let acc = 0;
  const total = aggregates.reduce((s, a) => s + a.amount, 0);

  return aggregates.map((agg) => {
    const startAngle = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += agg.amount;
    const endAngle = (acc / total) * Math.PI * 2 - Math.PI / 2;
    return { ...agg, startAngle, endAngle };
  });
}

/** Generate the SVG path for a donut arc. */
export function arcPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const x1 = cx + outerR * Math.cos(startAngle);
  const y1 = cy + outerR * Math.sin(startAngle);
  const x2 = cx + outerR * Math.cos(endAngle);
  const y2 = cy + outerR * Math.sin(endAngle);
  const x3 = cx + innerR * Math.cos(endAngle);
  const y3 = cy + innerR * Math.sin(endAngle);
  const x4 = cx + innerR * Math.cos(startAngle);
  const y4 = cy + innerR * Math.sin(startAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4} Z`;
}

/** Compute the percentage of pool a distribution represents. */
export function poolSharePct(amount: number, poolTotal: number): number {
  if (poolTotal <= 0) return 0;
  return (amount / poolTotal) * 100;
}

/** Extract hours worked from explanation or featuresSnapshot. */
export function getHoursWorked(dist: TipDistribution): number {
  return toNum(dist.explanation.hoursWorked ?? dist.featuresSnapshot?.hoursWorked);
}

/** Extract sales generated from explanation or featuresSnapshot. */
export function getSalesGenerated(dist: TipDistribution): number {
  return toNum(dist.explanation.salesGenerated ?? dist.featuresSnapshot?.salesGenerated);
}

/** Extract raw/contribution score. */
export function getRawScore(dist: TipDistribution): number {
  return toNum(dist.explanation.rawScore ?? dist.contributionScore);
}

/** Compute per-hour rate. */
export function perHourRate(amount: number, hours: number): number {
  if (hours <= 0) return 0;
  return amount / hours;
}

/** Whether the sales bonus meaningfully contributed (> 0.1% above 1.0). */
export function hasSalesBonus(salesBonusStr: string | undefined): boolean {
  const sb = toNum(salesBonusStr);
  return sb > 1.0001;
}
