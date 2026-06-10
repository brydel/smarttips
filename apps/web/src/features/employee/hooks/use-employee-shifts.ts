'use client';

import { useQuery } from '@tanstack/react-query';
import { getMyDistributions } from '../api/employee.api';
import { EMPLOYEE_DISTRIBUTIONS_KEY } from '../../../lib/query-keys';
import type { TipPeriod } from '../types/employee.types';

/** Hook: employee's personal shift/tip history (GET /employee/me/distributions). */
export function useEmployeeShifts(range: TipPeriod = '30d') {
  return useQuery({
    queryKey: [EMPLOYEE_DISTRIBUTIONS_KEY, range],
    queryFn: ({ signal }) => getMyDistributions({ range }, signal),
    retry: 1,
    staleTime: 2 * 60 * 1000,
  });
}
