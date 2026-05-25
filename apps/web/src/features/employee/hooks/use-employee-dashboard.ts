'use client';

import { useQuery } from '@tanstack/react-query';
import { getMyDashboard } from '../api/employee.api';
import { EMPLOYEE_DASHBOARD_KEY } from '../../../lib/query-keys';

/**
 * Hook: employee's personal tip dashboard.
 *
 * NOTE: The backend endpoint GET /employee/me/dashboard does not exist yet.
 * `notImplemented` is returned as `true` so pages show a "coming soon" state.
 * Once the endpoint is added, set ENDPOINT_READY = true and remove the flag.
 */
const ENDPOINT_READY = false;

export function useEmployeeDashboard() {
  const query = useQuery({
    queryKey: [EMPLOYEE_DASHBOARD_KEY],
    queryFn: ({ signal }) => getMyDashboard(signal),
    enabled: ENDPOINT_READY,
    retry: false,
    staleTime: 2 * 60 * 1000,
  });

  return { ...query, notImplemented: !ENDPOINT_READY };
}
