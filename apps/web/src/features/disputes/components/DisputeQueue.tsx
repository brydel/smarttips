'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, MessagesSquare, RefreshCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

import { cn } from '../../../lib/cn';
import {
  fmtMoneyShort,
  fmtShiftDateShort,
  fmtShiftType,
} from '../../employee/utils/employee-formatters';
import { useDisputesQueue } from '../hooks/use-disputes-queue';
import type {
  DisputeQueueFilters,
  ManagerDispute,
  TipDisputeCategory,
  TipDisputeStatus,
} from '../types/dispute.types';
import { DISPUTE_CATEGORY_LABELS, DISPUTE_STATUS_CONFIG } from '../utils/dispute-labels';
import { DisputeDetailDrawer } from './DisputeDetailDrawer';

const STATUS_TABS: { value: TipDisputeStatus; label: string }[] = [
  { value: 'OPEN', label: 'À traiter' },
  { value: 'IN_REVIEW', label: 'En cours' },
  { value: 'RESOLVED', label: 'Résolues' },
  { value: 'WITHDRAWN', label: 'Retirées' },
];

const CATEGORY_ORDER: TipDisputeCategory[] = ['AMOUNT', 'HOURS', 'ROLE', 'OTHER'];

const EMPTY_MESSAGES: Record<TipDisputeStatus, { title: string; sub: string }> = {
  OPEN: {
    title: 'Aucun litige en attente',
    sub: 'Les questions de vos employés apparaîtront ici.',
  },
  IN_REVIEW: {
    title: 'Aucun litige en cours',
    sub: 'Les litiges pris en charge apparaîtront ici.',
  },
  RESOLVED: {
    title: 'Aucun litige résolu',
    sub: 'Les litiges résolus apparaîtront ici.',
  },
  WITHDRAWN: {
    title: 'Aucun litige retiré',
    sub: 'Les demandes retirées par les employés apparaîtront ici.',
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

interface DisputeRowProps {
  dispute: ManagerDispute;
  onSelect: (dispute: ManagerDispute) => void;
}

function DisputeRow({ dispute, onSelect }: DisputeRowProps) {
  const status = DISPUTE_STATUS_CONFIG[dispute.status];
  const age = formatDistanceToNow(new Date(dispute.createdAt), { addSuffix: true, locale: fr });
  const employeeName = `${dispute.employee.firstName} ${dispute.employee.lastName}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(dispute)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-left hover:bg-st-raised transition-colors border border-transparent hover:border-st-border cursor-pointer"
      style={{ fontFamily: 'inherit' }}
      aria-label={`Ouvrir le litige de ${employeeName}`}
    >
      <span
        className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0"
        style={{ background: status.bg, color: status.color }}
        aria-hidden="true"
      >
        <MessagesSquare size={13} />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] truncate" style={{ color: 'var(--st-hi)' }}>
          {employeeName} · {DISPUTE_CATEGORY_LABELS[dispute.category]} ·{' '}
          <span className="font-mono">{fmtMoneyShort(dispute.evidenceSnapshot.amount)}</span>
        </p>
        <p className="text-[11px]" style={{ color: 'var(--st-dim)' }}>
          {fmtShiftType(dispute.evidenceSnapshot.shiftType)} du{' '}
          {fmtShiftDateShort(dispute.evidenceSnapshot.shiftDate)} · {age}
        </p>
      </div>

      <span
        className="shrink-0 px-2 py-0.5 rounded-pill text-[10px] font-mono uppercase tracking-[0.05em] border hidden sm:inline-block"
        style={{ color: status.color, background: status.bg, borderColor: status.border }}
      >
        {status.label}
      </span>

      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--st-dim)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
        aria-hidden="true"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

export function DisputeQueue() {
  const [statusFilter, setStatusFilter] = useState<TipDisputeStatus>('OPEN');
  const [categoryFilter, setCategoryFilter] = useState<TipDisputeCategory | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters = useMemo<DisputeQueueFilters>(
    () => ({
      status: [statusFilter],
      ...(categoryFilter ? { category: [categoryFilter] } : {}),
    }),
    [statusFilter, categoryFilter],
  );

  const {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
    startReview,
    resolve,
    isReviewing,
    isResolving,
  } = useDisputesQueue(filters);

  const selected: ManagerDispute | null =
    data?.items.find((item) => item.id === selectedId) ?? null;

  return (
    <section
      className="rounded-[14px] border border-st-border bg-st-card p-4 sm:p-5"
      aria-label="File des litiges"
    >
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-3 mb-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <MessagesSquare size={14} style={{ color: 'var(--st-indigo-glow)' }} aria-hidden="true" />
          <span
            className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium"
            style={{ color: 'var(--st-sec)' }}
          >
            Litiges{data ? ` · ${data.total}` : ''}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Filtre catégorie */}
          <div className="hidden md:flex gap-1" role="group" aria-label="Filtrer par catégorie">
            {CATEGORY_ORDER.map((category) => {
              const active = categoryFilter === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(active ? null : category)}
                  aria-pressed={active}
                  className="px-2 py-0.5 rounded-pill text-[10px] font-mono uppercase tracking-[0.05em] border transition-colors cursor-pointer"
                  style={{
                    color: active ? 'var(--st-indigo-glow)' : 'var(--st-dim)',
                    background: active ? 'rgba(99,102,241,.12)' : 'transparent',
                    borderColor: active ? 'rgba(99,102,241,.3)' : 'var(--st-border)',
                    fontFamily: 'inherit',
                  }}
                >
                  {DISPUTE_CATEGORY_LABELS[category]}
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
            aria-label="Actualiser la file des litiges"
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
            Impossible de charger les litiges.
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
            {data.items.map((dispute) => (
              <DisputeRow
                key={dispute.id}
                dispute={dispute}
                onSelect={(item) => setSelectedId(item.id)}
              />
            ))}
          </div>
          {data.total > data.items.length && (
            <p className="text-[11px] mt-2.5 px-3" style={{ color: 'var(--st-dim)' }}>
              {data.items.length} affichés sur {data.total}.
            </p>
          )}
        </>
      )}

      <DisputeDetailDrawer
        dispute={selected}
        onClose={() => setSelectedId(null)}
        onStartReview={startReview}
        onResolve={resolve}
        reviewing={isReviewing}
        resolving={isResolving}
      />
    </section>
  );
}
