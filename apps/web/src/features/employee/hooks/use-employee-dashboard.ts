'use client';

import { useQuery } from '@tanstack/react-query';
import { getMyDashboard } from '../api/employee.api';
import { EMPLOYEE_DASHBOARD_KEY } from '../../../lib/query-keys';

/** Hook: employee's personal tip dashboard (GET /employee/me/dashboard). */
export function useEmployeeDashboard() {
  return useQuery({
    queryKey: [EMPLOYEE_DASHBOARD_KEY],
    queryFn: ({ signal }) => getMyDashboard(signal),
    retry: 1,
    staleTime: 2 * 60 * 1000,
  });
}
