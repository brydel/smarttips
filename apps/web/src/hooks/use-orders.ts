import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createOrder, fetchOrders } from '../services/orders.service';
import { ORDERS_KEY, SHIFTS_KEY } from '../lib/query-keys';
import { extractErrorMessage } from '../lib/errors';
import type { CreateOrderPayload, Order, OrderFilters } from '../types/order';

// ── Queries ───────────────────────────────────────────────────────────────────

export function useOrders(filters: OrderFilters = {}) {
  return useQuery<Order[]>({
    queryKey: [ORDERS_KEY, filters],
    queryFn: ({ signal }) => fetchOrders(filters, signal),
    staleTime: 15_000,
    enabled: Boolean(filters.shiftId),
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateOrder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateOrderPayload) => createOrder(payload),
    onSuccess: () => {
      toast.success('Commande créée');
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, 'Erreur lors de la création de la commande'));
    },
    onSettled: (_, __, payload) => {
      void qc.invalidateQueries({ queryKey: [ORDERS_KEY, { shiftId: payload.shiftId }] });
      void qc.invalidateQueries({ queryKey: [ORDERS_KEY] });
      void qc.invalidateQueries({ queryKey: [SHIFTS_KEY] });
    },
  });
}
