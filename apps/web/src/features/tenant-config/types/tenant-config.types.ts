// ── Distribution config — types that mirror the backend contract ──────────

export type DistributionMode = 'RULES_ONLY' | 'ML_ASSISTED' | 'ML_FULL';

export type RoleName = 'SERVER' | 'BARTENDER' | 'BUSSER' | 'HOST' | 'COOK' | 'CHEF';

export type RoleCoefficients = Record<RoleName, number>;

/** Shape returned by GET /tenant/distribution-config */
export type DistributionConfigResponse = {
  source: 'DEFAULT' | 'CUSTOM';
  mode: DistributionMode;
  roleCoefficients: Record<RoleName, string>; // strings from backend
  minPerHour: string;
  maxSharePct: string;
  salesBonusWeight: string;
  tenureBonusEnabled: boolean;
  fairnessAuditEnabled: boolean;
  coldStartThreshold: number;
  updatedAt: string | null;
};

/** Parsed, numeric form of the config (used in local state) */
export type DistributionConfig = {
  source: 'DEFAULT' | 'CUSTOM';
  mode: 'RULES_ONLY'; // Only active mode; ML options are display-only
  roleCoefficients: RoleCoefficients;
  minPerHour: number;
  maxSharePct: number;
  salesBonusWeight: number;
  tenureBonusEnabled: boolean;
  fairnessAuditEnabled: boolean;
  coldStartThreshold: number;
  updatedAt: string | null;
};

/** Payload for PATCH /tenant/distribution-config — only changed fields */
export type UpdateDistributionConfigPayload = {
  mode?: 'RULES_ONLY';
  roleCoefficients?: Partial<RoleCoefficients>;
  minPerHour?: number;
  maxSharePct?: number;
  salesBonusWeight?: number;
  tenureBonusEnabled?: boolean;
  fairnessAuditEnabled?: boolean;
  coldStartThreshold?: number;
};

/** Editable numeric fields on the distribution config */
export type ConfigNumericKey =
  | 'minPerHour'
  | 'maxSharePct'
  | 'salesBonusWeight'
  | 'coldStartThreshold';

/** Editable boolean toggle fields */
export type ConfigBoolKey = 'tenureBonusEnabled' | 'fairnessAuditEnabled';

/** Union of all editable field keys (excludes source, mode, roleCoefficients, updatedAt) */
export type ConfigEditableKey = ConfigNumericKey | ConfigBoolKey;

/** Validation error map (field key → message) */
export type DistributionValidationErrors = Partial<
  Record<
    RoleName | 'minPerHour' | 'maxSharePct' | 'salesBonusWeight' | 'coldStartThreshold',
    string
  >
>;

/** Default config values — used for local reset only (no backend DELETE) */
export const DEFAULT_DISTRIBUTION_CONFIG: DistributionConfig = {
  source: 'DEFAULT',
  mode: 'RULES_ONLY',
  roleCoefficients: {
    SERVER: 1.0,
    BARTENDER: 0.9,
    BUSSER: 0.7,
    HOST: 0.6,
    COOK: 0.5,
    CHEF: 0.8,
  },
  minPerHour: 2.0,
  maxSharePct: 35,
  salesBonusWeight: 0.5,
  tenureBonusEnabled: true,
  fairnessAuditEnabled: true,
  coldStartThreshold: 30,
  updatedAt: null,
};

export const ROLE_NAMES: RoleName[] = ['SERVER', 'BARTENDER', 'BUSSER', 'HOST', 'COOK', 'CHEF'];

export type RoleMeta = { label: string; color: string };

export const ROLE_META: Record<RoleName, RoleMeta> = {
  SERVER: { label: 'Serveur·euse', color: '#818CF8' },
  BARTENDER: { label: 'Barman·aid', color: '#E8C49A' },
  BUSSER: { label: 'Runner', color: '#8892B0' },
  HOST: { label: 'Accueil', color: '#34D399' },
  COOK: { label: 'Cuisinier', color: '#BCB19A' },
  CHEF: { label: 'Chef', color: '#F87171' },
};

/** Sim headcount for the preview simulator */
export const SIM_HEADCOUNT: Record<RoleName, number> = {
  SERVER: 4,
  BARTENDER: 2,
  BUSSER: 2,
  HOST: 1,
  COOK: 3,
  CHEF: 1,
};
