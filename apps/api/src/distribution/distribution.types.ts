import { ComputationMethod, DistributionMode, EmployeeRole, Prisma } from '@prisma/client';

// NOTE: these branded id types duplicate the ones declared locally in
// ml-client.service.ts. They are structurally identical (Brand<string, Name>) so
// they interoperate, but the definitions should be consolidated into a shared
// common/branded.ts in a follow-up — tracked, out of scope for BIS-29.
export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type TenantId = Brand<string, 'TenantId'>;
export type TipPoolId = Brand<string, 'TipPoolId'>;
export type ShiftId = Brand<string, 'ShiftId'>;
export type EmployeeId = Brand<string, 'EmployeeId'>;

export const DISTRIBUTION_EXPLANATION_SCHEMA_VERSION = 1 as const;
export const DISTRIBUTION_ENGINE_VERSION = 'distribution-engine-v1' as const;

export const SALES_ELIGIBLE_ROLES: ReadonlySet<EmployeeRole> = new Set<EmployeeRole>([
  EmployeeRole.SERVER,
  EmployeeRole.BARTENDER,
]);

export const DEFAULT_ROLE_COEFFICIENTS = Object.freeze({
  [EmployeeRole.SERVER]: new Prisma.Decimal('1.0'),
  [EmployeeRole.BARTENDER]: new Prisma.Decimal('0.9'),
  [EmployeeRole.BUSSER]: new Prisma.Decimal('0.7'),
  [EmployeeRole.HOST]: new Prisma.Decimal('0.6'),
  [EmployeeRole.COOK]: new Prisma.Decimal('0.5'),
  [EmployeeRole.CHEF]: new Prisma.Decimal('0.8'),
} satisfies Readonly<Record<EmployeeRole, Prisma.Decimal>>);

export interface DistributionConfig {
  readonly roleCoefficients: Readonly<Record<EmployeeRole, Prisma.Decimal>>;
  readonly minimumPerHour: Prisma.Decimal;
  readonly maxSharePercent: Prisma.Decimal;
  readonly salesBonusWeight: Prisma.Decimal;
  // Version of the policy that produced a decision, stamped into every
  // explanation for auditability. Populated by resolveConfig (see file 3).
  readonly policyVersion: string;
}

export interface EmployeeShiftInput {
  readonly employeeId: EmployeeId;
  readonly role: EmployeeRole;
  readonly hoursWorked: Prisma.Decimal;
  readonly salesGenerated: Prisma.Decimal;
  readonly coefficient: Prisma.Decimal;
}

export interface DistributionInput {
  readonly tenantId: TenantId;
  readonly tipPoolId: TipPoolId;
  readonly shiftId: ShiftId;
  readonly totalAmount: Prisma.Decimal;
  readonly config: DistributionConfig;
  readonly employees: readonly EmployeeShiftInput[];
  readonly computationMethod: ComputationMethod;
}

// ---------------------------------------------------------------------------
// Explanation is a discriminated union on `source`, so each row records HOW it
// was actually computed — the core of SmartTips' radical explainability and the
// fairness audit. Every explanation is stamped with the schema/engine/policy
// version that produced it, so old rows stay interpretable. The DB column is
// Json, so this is NOT a migration; legacy rows have no `source`/versions and
// are typed via PersistedDistributionExplanation and read as RULES.
// ---------------------------------------------------------------------------

export type ExplanationSource = 'RULES' | 'ML_FULL' | 'ML_ASSISTED';

interface BaseAllocationExplanation {
  readonly schemaVersion: typeof DISTRIBUTION_EXPLANATION_SCHEMA_VERSION;
  readonly source: ExplanationSource;
  readonly engineVersion: typeof DISTRIBUTION_ENGINE_VERSION;
  readonly policyVersion: string;
  // share/rawAmount reflect the weight that actually drove the split
  // (rules score, ML, or blend), so the audit reads the real basis.
  readonly scoreShare: string;
  readonly rawAmount: string;
  readonly capAmount: string;
  readonly minAmount: string;
  readonly capApplied: boolean;
  readonly minimumApplied: boolean;
  readonly roundingAdjustmentCents: number;
  readonly finalAmount: string;
}

export interface RulesExplanation extends BaseAllocationExplanation {
  readonly source: 'RULES';
  readonly roleCoefficient: string;
  readonly employeeCoefficient: string;
  readonly hoursWorked: string;
  readonly salesGenerated: string;
  readonly shiftAvgSales: string;
  readonly salesBonus: string;
  readonly baseScore: string;
  readonly rawScore: string;
}

export interface MlFullExplanation extends BaseAllocationExplanation {
  readonly source: 'ML_FULL';
  readonly modelVersion: number;
  readonly mlWeight: string; // raw weight returned by the model
  readonly mlShare: string; // model's own normalized share
}

export interface MlAssistedExplanation extends BaseAllocationExplanation {
  readonly source: 'ML_ASSISTED';
  readonly modelVersion: number;
  readonly mlWeight: string;
  readonly mlShare: string;
  readonly rulesShare: string; // the rules scoreShare blended in
  readonly blendAlpha: string; // weight given to the ML share in the convex blend
}

export type DistributionExplanation = RulesExplanation | MlFullExplanation | MlAssistedExplanation;

// Read model: legacy rows predate the source/version fields and are treated as
// RULES. The 4 audit fields are optional here precisely to model old data.
export type LegacyRulesExplanation = Omit<
  RulesExplanation,
  'schemaVersion' | 'source' | 'engineVersion' | 'policyVersion'
> &
  Partial<Pick<RulesExplanation, 'schemaVersion' | 'source' | 'engineVersion' | 'policyVersion'>>;

export type PersistedDistributionExplanation = DistributionExplanation | LegacyRulesExplanation;

export function isRulesExplanation(
  explanation: PersistedDistributionExplanation,
): explanation is RulesExplanation | LegacyRulesExplanation {
  return explanation.source === undefined || explanation.source === 'RULES';
}

export function isMlExplanation(
  explanation: PersistedDistributionExplanation,
): explanation is MlFullExplanation | MlAssistedExplanation {
  return explanation.source === 'ML_FULL' || explanation.source === 'ML_ASSISTED';
}

export interface DistributionResult {
  readonly employeeId: EmployeeId;
  readonly amount: Prisma.Decimal;
  // Persisted to TipDistribution.contributionScore (name kept column-aligned).
  // Meaning varies by source: RULES = raw rules score, ML_FULL = ML weight,
  // ML_ASSISTED = blended weight. explanation.source disambiguates.
  readonly contributionScore: Prisma.Decimal;
  readonly explanation: DistributionExplanation;
}

export interface DistributionComputationResult {
  readonly tenantId: TenantId;
  readonly tipPoolId: TipPoolId;
  readonly shiftId: ShiftId;
  readonly computationMethod: ComputationMethod;
  readonly totalAmount: Prisma.Decimal;
  readonly distributedAmount: Prisma.Decimal;
  // Must be 0 after final allocation; non-zero is an invariant violation.
  readonly remainderCents: 0;
  readonly results: readonly DistributionResult[];
}

// Pure branded constructors. NO format validation here: UUID format is a boundary
// concern enforced by ParseUUIDPipe at the controller, and throwing inside a
// constructor would surface as an uncaught 500 and break tests with simple ids.
// These centralize the cast so it is named and greppable.
export function toTenantId(value: string): TenantId {
  return value as TenantId;
}

export function toTipPoolId(value: string): TipPoolId {
  return value as TipPoolId;
}

export function toShiftId(value: string): ShiftId {
  return value as ShiftId;
}

export function toEmployeeId(value: string): EmployeeId {
  return value as EmployeeId;
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}

// The orchestrator dispatches on the CONFIGURED mode (DistributionMode), not on
// ComputationMethod (the REALIZED method). There is deliberately no
// modeToComputationMethod mapping: it is not 1:1 (ML_FULL mode + fallback ->
// RULES method), and such a helper would invite persisting the configured mode
// instead of what actually ran. The orchestrator sets the realized method itself.
export function assertSupportedMode(mode: DistributionMode): void {
  switch (mode) {
    case DistributionMode.RULES_ONLY:
    case DistributionMode.ML_ASSISTED:
    case DistributionMode.ML_FULL:
      return;
    default:
      return assertNever(mode);
  }
}
