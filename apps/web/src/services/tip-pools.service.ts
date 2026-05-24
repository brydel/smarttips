import { apiClient } from '../lib/api-client';
import type { CreateTipPoolPayload, TipPool } from '../types/tip-pool';

const BASE = '/tip-pools';

export async function createTipPool(payload: CreateTipPoolPayload): Promise<TipPool> {
  const body = { ...payload };
  if (body.notes === '') delete body.notes;
  const { data } = await apiClient.post<TipPool>(BASE, body);
  return data;
}

export async function fetchTipPoolByShift(shiftId: string, signal?: AbortSignal): Promise<TipPool> {
  const { data } = await apiClient.get<TipPool>(`${BASE}/shift/${shiftId}`, { signal });
  return data;
}
