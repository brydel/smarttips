import { apiClient } from '../../../lib/api-client';
import type {
  DistributionConfig,
  DistributionConfigResponse,
  UpdateDistributionConfigPayload,
} from '../types/tenant-config.types';

/** Parse backend response (string fields) into numeric DistributionConfig */
function parseConfig(raw: DistributionConfigResponse): DistributionConfig {
  return {
    source: raw.source,
    // Always coerce to RULES_ONLY — ML modes are backend-side future work
    mode: 'RULES_ONLY',
    roleCoefficients: {
      SERVER: parseFloat(raw.roleCoefficients.SERVER),
      BARTENDER: parseFloat(raw.roleCoefficients.BARTENDER),
      BUSSER: parseFloat(raw.roleCoefficients.BUSSER),
      HOST: parseFloat(raw.roleCoefficients.HOST),
      COOK: parseFloat(raw.roleCoefficients.COOK),
      CHEF: parseFloat(raw.roleCoefficients.CHEF),
    },
    minPerHour: parseFloat(raw.minPerHour),
    maxSharePct: parseFloat(raw.maxSharePct),
    salesBonusWeight: parseFloat(raw.salesBonusWeight),
    tenureBonusEnabled: raw.tenureBonusEnabled,
    fairnessAuditEnabled: raw.fairnessAuditEnabled,
    coldStartThreshold: raw.coldStartThreshold,
    updatedAt: raw.updatedAt,
  };
}

/** GET /tenant/distribution-config — accessible by OWNER and MANAGER */
export async function getDistributionConfig(): Promise<DistributionConfig> {
  const { data } = await apiClient.get<DistributionConfigResponse>('/tenant/distribution-config');
  return parseConfig(data);
}

/**
 * PATCH /tenant/distribution-config — OWNER only.
 * Payload must NOT include source, updatedAt, tenantId, userId.
 * ML modes must never be sent.
 */
export async function updateDistributionConfig(
  payload: UpdateDistributionConfigPayload,
): Promise<DistributionConfig> {
  const { data } = await apiClient.patch<DistributionConfigResponse>(
    '/tenant/distribution-config',
    payload,
  );
  return parseConfig(data);
}
