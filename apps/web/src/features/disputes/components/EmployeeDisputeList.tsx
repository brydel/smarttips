'use client';

import { useState } from 'react';
import { MessageCircleQuestion, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { cn } from '../../../lib/cn';
import {
  fmtMoneyShort,
  fmtShiftDateShort,
  fmtShiftType,
} from '../../employee/utils/employee-formatters';
import type { EmployeeDispute } from '../types/dispute.types';
import {
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_OUTCOME_LABELS,
  DISPUTE_STATUS_CONFIG,
} from '../utils/dispute-labels';

interface DisputeCardProps {
  dispute: EmployeeDispute;
  onWithdraw: (id: string) => Promise<unknown>;
  withdrawing: boolean;
}

function DisputeCard({ dispute, onWithdraw, withdrawing }: DisputeCardProps) {
  const [confirming, setConfirming] = useState(false);
  const status = DISPUTE_STATUS_CONFIG[dispute.status];
  const snapshot = dispute.evidenceSnapshot;

  return (
    <div className="bg-st-card border border-st-border rounded-xl p-4 flex flex-col gap-3">
      {/* En-tête : contexte + statut */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-st-hi font-medium font-sans">
            {fmtShiftType(snapshot.shiftType)} · {fmtShiftDateShort(snapshot.shiftDate)}
          </p>
          <p className="text-[11px] text-st-sec font-sans mt-0.5">
            {DISPUTE_CATEGORY_LABELS[dispute.category]} ·{' '}
            <span className="font-mono">{fmtMoneyShort(snapshot.amount)}</span> · envoyée le{' '}
            {format(new Date(dispute.createdAt), 'd MMMM yyyy', { locale: fr })}
          </p>
        </div>
        <span
          className="shrink-0 px-2 py-0.5 rounded-pill text-[10px] font-mono uppercase tracking-[0.05em] border"
          style={{ color: status.color, background: status.bg, borderColor: status.border }}
        >
          {status.label}
        </span>
      </div>

      {/* Question de l'employé */}
      <p className="text-[12px] text-st-sec font-sans leading-relaxed whitespace-pre-wrap">
        {dispute.message}
      </p>

      {/* Réponse du gestionnaire */}
      {dispute.status === 'RESOLVED' && (
        <div
          className="rounded-[10px] p-3 flex flex-col gap-1.5"
          style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.18)' }}
        >
          {dispute.outcome && (
            <p className="text-[11px] font-medium" style={{ color: 'var(--st-emerald-glow)' }}>
              {DISPUTE_OUTCOME_LABELS[dispute.outcome]}
            </p>
          )}
          {dispute.resolutionNote && (
            <p className="text-[12px] text-st-sec font-sans leading-relaxed whitespace-pre-wrap">
              {dispute.resolutionNote}
            </p>
          )}
          {dispute.resolvedAt && (
            <p className="text-[10.5px] text-st-dim font-mono">
              Répondu le {format(new Date(dispute.resolvedAt), 'd MMMM yyyy', { locale: fr })}
            </p>
          )}
        </div>
      )}

      {dispute.status === 'IN_REVIEW' && (
        <p className="text-[11.5px] text-st-dim font-sans italic">
          Votre gestionnaire examine votre demande.
        </p>
      )}

      {/* Retrait — uniquement tant que la demande est en attente */}
      {dispute.status === 'OPEN' && (
        <div className="flex items-center justify-end gap-2">
          {confirming ? (
            <>
              <span className="text-[11.5px] text-st-sec">Retirer cette demande ?</span>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={withdrawing}
                className="px-2.5 py-1.5 rounded-[8px] text-[11.5px] border border-st-border text-st-sec hover:bg-st-raised transition-colors cursor-pointer"
                style={{ background: 'transparent', fontFamily: 'inherit' }}
              >
                Non
              </button>
              <button
                type="button"
                onClick={() => void onWithdraw(dispute.id).finally(() => setConfirming(false))}
                disabled={withdrawing}
                className="px-2.5 py-1.5 rounded-[8px] text-[11.5px] font-medium text-white transition-colors disabled:opacity-60 cursor-pointer"
                style={{
                  background: '#DC2626',
                  border: '1px solid transparent',
                  fontFamily: 'inherit',
                }}
              >
                {withdrawing ? 'Retrait…' : 'Oui, retirer'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[11.5px] border border-st-border text-st-sec hover:text-st-hi hover:bg-st-raised transition-colors cursor-pointer"
              style={{ background: 'transparent', fontFamily: 'inherit' }}
            >
              <Undo2 size={12} /> Retirer ma demande
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface EmployeeDisputeListProps {
  disputes: EmployeeDispute[] | null;
  isLoading: boolean;
  isError: boolean;
  onWithdraw: (id: string) => Promise<unknown>;
  withdrawing: boolean;
}

export function EmployeeDisputeList({
  disputes,
  isLoading,
  isError,
  onWithdraw,
  withdrawing,
}: EmployeeDisputeListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} className="bg-st-card border border-st-border rounded-xl p-4 animate-pulse">
            <div className="h-3 w-1/2 rounded bg-st-raised mb-2" />
            <div className="h-2.5 w-2/3 rounded bg-st-raised" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-st-border bg-st-card p-6 text-center" role="alert">
        <p className="text-[13px] text-st-sec font-sans">
          Impossible de charger vos demandes. Réessayez.
        </p>
      </div>
    );
  }

  if (!disputes || disputes.length === 0) {
    return (
      <div className="rounded-xl border border-st-border bg-st-card p-8 text-center">
        <MessageCircleQuestion size={24} className="text-st-dim mx-auto mb-3" />
        <p className="text-[13px] text-st-sec font-sans">Aucune demande pour le moment.</p>
        <p className="text-[11.5px] text-st-dim font-sans mt-1">
          Vous pouvez poser une question depuis l&apos;historique de vos shifts.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2')}>
      {disputes.map((dispute) => (
        <DisputeCard
          key={dispute.id}
          dispute={dispute}
          onWithdraw={onWithdraw}
          withdrawing={withdrawing}
        />
      ))}
    </div>
  );
}
