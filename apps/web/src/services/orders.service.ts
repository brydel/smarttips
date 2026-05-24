import { apiClient } from '../lib/api-client';
import type { CreateOrderPayload, Order, OrderFilters } from '../types/order';

const BASE = '/orders';

/** Strip empty-string optional notes fields before sending (NestJS @IsNotEmpty guard). */
function cleanPayload<T extends { notes?: string }>(payload: T): T {
  const out = { ...payload };
  if (out.notes === '') delete out.notes;
  return out;
}

export async function fetchOrders(
  filters: OrderFilters = {},
  signal?: AbortSignal,
): Promise<Order[]> {
  const params = new URLSearchParams();
  if (filters.shiftId) params.set('shiftId', filters.shiftId);
  if (filters.serverId) params.set('serverId', filters.serverId);
  if (filters.tableId) params.set('tableId', filters.tableId);
  if (filters.status) params.set('status', filters.status);
  if (filters.limit) params.set('limit', String(filters.limit));

  const url = params.toString() ? `${BASE}?${params}` : BASE;
  const { data } = await apiClient.get<Order[]>(url, { signal });
  return data;
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const body = {
    ...payload,
    items: payload.items.map(cleanPayload),
  };
  const { data } = await apiClient.post<Order>(BASE, body);
  return data;
}
