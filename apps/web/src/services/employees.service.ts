import { apiClient } from '../lib/api-client';
import type {
  Employee,
  CreateEmployeePayload,
  UpdateEmployeePayload,
  EmployeeFilters,
} from '../types/employee';

const BASE = '/employees';

export async function fetchEmployees(
  filters: EmployeeFilters = {},
  signal?: AbortSignal,
): Promise<Employee[]> {
  const params = new URLSearchParams();
  if (filters.role !== undefined) params.set('role', filters.role);
  if (filters.active !== undefined) params.set('active', String(filters.active));

  const url = params.toString() ? `${BASE}?${params}` : BASE;
  const { data } = await apiClient.get<Employee[]>(url, { signal });
  return data;
}

export async function fetchEmployee(id: string): Promise<Employee> {
  const { data } = await apiClient.get<Employee>(`${BASE}/${id}`);
  return data;
}

export async function createEmployee(payload: CreateEmployeePayload): Promise<Employee> {
  const { data } = await apiClient.post<Employee>(BASE, payload);
  return data;
}

export async function updateEmployee(
  id: string,
  payload: UpdateEmployeePayload,
): Promise<Employee> {
  const { data } = await apiClient.patch<Employee>(`${BASE}/${id}`, payload);
  return data;
}

export async function deleteEmployee(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

export async function inviteEmployee(id: string): Promise<void> {
  await apiClient.post(`${BASE}/${id}/invite`);
}
