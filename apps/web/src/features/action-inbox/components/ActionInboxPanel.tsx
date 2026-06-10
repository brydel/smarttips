'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Inbox, RefreshCcw } from 'lucide-react';

import { cn } from '../../../lib/cn';
import { useActionInbox } from '../hooks/use-action-inbox';
import type {
  ActionInboxFilters,
  ActionItem,
  ActionItemSeverity,
  ActionItemStatus,
} from '../types/action-inbox.types';
import { SEVERITY_CONFIG } from '../utils/action-inbox-labels';
import { ActionItemRow } from './ActionItemRow';
import { ActionItemDetailDrawer } from './ActionItemDetailDrawer';

const STATUS_TABS: { value: ActionItemStatus; label: string }[] = [
  { value: 'OPEN', label: 'À traiter' },
  { value: 'RESOLVED', label: 'Résolues' },
  { value: 'DISMISSED', label: 'Ignorées' },
];

const SEVERITY_ORDER: ActionItemSeverity[] = ['CRITICAL', 'WARNING', 'INFO'];

const EMPTY_MESSAGES: Record<ActionItemStatus, { title: string; sub: string }> = {
  OPEN: {
    title: 'Tout est en ordre',
    sub: 'Aucune action en attente pour le moment.',
  },
  RESOLVED: {
    title: 'Aucune action résolue',
    sub: 'Les actions résolues apparaîtront ici.',
  },
  DISMISSED: {
    title: 'Aucune action ignorée',
    sub: 'Les actions ignorées apparaîtront ici.',
  },
};

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 animate-pulse" aria-hidden="true">
      <div className="w-7 h-7 rounded-[6px] bg-st-raised shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="h-3 w-2/3 rounded bg-st-raised mb-1.5" />
        <div className="h-2.5 w-1/3 rounded bg-st-raised" />
      </div>
    </div>
  );
}

export function ActionInboxPanel() {
  const [statusFilter, setStatusFilter] = useState<ActionItemStatus>('OPEN');
  const [severityFilter, setSeverityFilter] = useState<ActionItemSeverity | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters = useMemo<ActionInboxFilters>(
    () => ({
      status: [statusFilter],
      ...(severityFilter ? { severity: [severityFilter] } : {}),
    }),
    [statusFilter, severityFilter],
  );

  const { data, isLoading, isError, isFetching, refetch, updateStatus, isUpdating } =
    useActionInbox(filters);

  const selected: ActionItem | null = data?.items.find((item) => item.id === selectedId) ?? null;

  return (
    <section
      className="rounded-[14px] border border-st-border bg-st-card p-4 sm:p-5"
      aria-label="Boîte d'actions manager"
    >
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-3 mb-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <Inbox size={14} style={{ color: 'var(--st-indigo-glow)' }} aria-hidden="true" />
          <span
            className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium"
            style={{ color: 'var(--st-sec)' }}
          >
            Boîte d&apos;actions{data ? ` · ${data.total}` : ''}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Filtre sévérité */}
          <div className="hidden md:flex gap-1" role="group" aria-label="Filtrer par sévérité">
            {SEVERITY_ORDER.map((sev) => {
              const cfg = SEVERITY_CONFIG[sev];
              const active = severityFilter === sev;
              return (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverityFilter(active ? null : sev)}
                  aria-pressed={active}
                  className="px-2 py-0.5 rounded-pill text-[10px] font-mono uppercase tracking-[0.05em] border transition-colors cursor-pointer"
                  style={{
                    color: active ? cfg.color : 'var(--st-dim)',
                    background: active ? cfg.bg : 'transparent',
                    borderColor: active ? cfg.border : 'var(--st-border)',
                    fontFamily: 'inherit',
                  }}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Onglets statut */}
          <div
            className="flex gap-1 p-0.5 rounded-[10px] border border-st-border"
            style={{ background: 'var(--st-card)' }}
            role="group"
            aria-label="Filtrer par statut"
          >
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                aria-pressed={statusFilter === tab.value}
                className={cn(
                  'px-2.5 py-1 rounded-[8px] text-[11px] font-medium transition-colors cursor-pointer border border-transparent',
                  statusFilter === tab.value
                    ? 'border-st-border text-st-hi'
                    : 'text-st-sec hover:text-st-hi',
                )}
                style={{
                  background: statusFilter === tab.value ? 'var(--st-border)' : 'transparent',
                  fontFamily: 'inherit',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label="Actualiser la boîte d'actions"
            className="p-1.5 rounded-[8px] border border-st-border hover:bg-st-raised transition-colors disabled:opacity-60 cursor-pointer"
            style={{ color: 'var(--st-sec)', background: 'transparent' }}
          >
            <RefreshCcw size={12} className={cn(isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Chargement */}
      {isLoading && (
        <div className="flex flex-col gap-0.5">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      )}

      {/* Erreur */}
      {isError && !isLoading && (
        <div className="flex flex-col items-center gap-3 py-8 text-center" role="alert">
          <p className="text-[12.5px]" style={{ color: 'var(--st-sec)' }}>
            Impossible de charger la boîte d&apos;actions.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[8px] text-[12px] font-medium border border-st-border hover:bg-st-raised transition-colors cursor-pointer"
            style={{ color: 'var(--st-hi)', background: 'transparent', fontFamily: 'inherit' }}
          >
            <RefreshCcw size={12} /> Réessayer
          </button>
        </div>
      )}

      {/* Vide */}
      {!isLoading && !isError && data && data.items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-7 text-center">
          <CheckCircle2
            size={22}
            style={{ color: 'var(--st-emerald-glow)', opacity: 0.85 }}
            aria-hidden="true"
          />
          <p className="text-[13px] font-medium" style={{ color: 'var(--st-pri)' }}>
            {EMPTY_MESSAGES[statusFilter].title}
          </p>
          <p className="text-[11.5px]" style={{ color: 'var(--st-dim)' }}>
            {EMPTY_MESSAGES[statusFilter].sub}
          </p>
        </div>
      )}

      {/* Liste */}
      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <div className="flex flex-col gap-0.5">
            {data.items.map((item) => (
              <ActionItemRow key={item.id} item={item} onSelect={(it) => setSelectedId(it.id)} />
            ))}
          </div>
          {data.total > data.items.length && (
            <p className="text-[11px] mt-2.5 px-3" style={{ color: 'var(--st-dim)' }}>
              {data.items.length} affichées sur {data.total}.
            </p>
          )}
        </>
      )}

      <ActionItemDetailDrawer
        item={selected}
        onClose={() => setSelectedId(null)}
        onUpdateStatus={updateStatus}
        updating={isUpdating}
      />
    </section>
  );
}
