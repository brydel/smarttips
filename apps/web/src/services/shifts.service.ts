import { apiClient } from '../lib/api-client';
import type {
  CreateAssignmentPayload,
  CreateShiftPayload,
  Shift,
  ShiftFilters,
  UpdateAssignmentPayload,
} from '../types/shift';

const BASE = '/shifts';

export async function fetchShifts(
  filters: ShiftFilters = {},
  signal?: AbortSignal,
): Promise<Shift[]> {
  const params = new URLSearchParams();
  if (filters.date) params.set('date', filters.date);

  const url = params.toString() ? `${BASE}?${params}` : BASE;
  const { data } = await apiClient.get<Shift[]>(url, { signal });
  return data;
}

export async function fetchShift(id: string, signal?: AbortSignal): Promise<Shift> {
  const { data } = await apiClient.get<Shift>(`${BASE}/${id}`, { signal });
  return data;
}

export async function createShift(payload: CreateShiftPayload): Promise<Shift> {
  const { data } = await apiClient.post<Shift>(BASE, payload);
  return data;
}

export async function closeShift(id: string): Promise<Shift> {
  const { data } = await apiClient.post<Shift>(`${BASE}/${id}/close`);
  return data;
}

export async function addAssignment(
  shiftId: string,
  payload: CreateAssignmentPayload,
): Promise<Shift> {
  const { data } = await apiClient.post<Shift>(`${BASE}/${shiftId}/assignments`, payload);
  return data;
}

export async function updateAssignment(
  shiftId: string,
  employeeId: string,
  payload: UpdateAssignmentPayload,
): Promise<Shift> {
  const { data } = await apiClient.patch<Shift>(
    `${BASE}/${shiftId}/assignments/${employeeId}`,
    payload,
  );
  return data;
}

export async function removeAssignment(shiftId: string, employeeId: string): Promise<void> {
  await apiClient.delete(`${BASE}/${shiftId}/assignments/${employeeId}`);
}
