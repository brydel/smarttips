'use client';

import { useAuth } from '../../../../../hooks/use-auth';
import { DistributionConfigForm } from '../../../../../features/tenant-config/components/DistributionConfigForm';

/**
 * /dashboard/settings/distribution
 *
 * OWNER  → can view and edit
 * MANAGER → can view, read-only
 * EMPLOYEE → blocked by DashboardShell (redirected to login before reaching this page)
 *
 * The dashboard layout already guards against EMPLOYEE access.
 * This page adds the additional OWNER vs MANAGER distinction.
 */
export default function DistributionSettingsPage() {
  const { user, isLoading } = useAuth();

  // Loading state is handled by the DashboardShell — user should always be set here.
  // But keep a safe guard in case.
  if (isLoading || !user) {
    return null;
  }

  const isOwner = user.role === 'OWNER';

  return <DistributionConfigForm isOwner={isOwner} />;
}
