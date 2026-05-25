'use client';

import { useQuery } from '@tanstack/react-query';
import { getMyProfile } from '../api/employee.api';
import { EMPLOYEE_PROFILE_KEY } from '../../../lib/query-keys';

/**
 * Hook: employee's own profile.
 *
 * Uses the existing GET /auth/me endpoint — always available.
 * Note: update mutations (PATCH /me, PATCH /me/password) are NOT implemented
 * in the backend yet. Update buttons in the profile form remain disabled.
 */
export function useEmployeeProfile() {
  return useQuery({
    queryKey: [EMPLOYEE_PROFILE_KEY],
    queryFn: ({ signal }) => getMyProfile(signal),
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status && status >= 400 && status < 500) return false;
      return failureCount < 1;
    },
  });
}
