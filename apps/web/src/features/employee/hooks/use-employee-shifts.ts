'use client';

import { useQuery } from '@tanstack/react-query';
import { getMyDistributions } from '../api/employee.api';
import { EMPLOYEE_DISTRIBUTIONS_KEY } from '../../../lib/query-keys';
import type { TipPeriod } from '../types/employee.types';

/**
 * Hook: employee's personal shift/tip history.
 *
 * NOTE: The backend endpoint GET /employee/me/distributions does not exist yet.
 * `notImplemented` is returned as `true` so pages show a "coming soon" state.
 * Once the endpoint is added, set ENDPOINT_READY = true and remove the flag.
 */
const ENDPOINT_READY = false;

export function useEmployeeShifts(range: TipPeriod = '30d') {
  const query = useQuery({
    queryKey: [EMPLOYEE_DISTRIBUTIONS_KEY, range],
    queryFn: ({ signal }) => getMyDistributions({ range }, signal),
    enabled: ENDPOINT_READY,
    retry: false,
    staleTime: 2 * 60 * 1000,
  });

  return { ...query, notImplemented: !ENDPOINT_READY };
}
