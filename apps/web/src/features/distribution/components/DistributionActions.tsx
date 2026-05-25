'use client';

import { CheckCircle, Lock, Edit3 } from 'lucide-react';
import type { UserRole } from '../../../contexts/auth.context';
import { Badge } from '../../../components/ui/badge';

interface DistributionActionsProps {
  userRole: UserRole;
}

/**
 * Action bar for distribution approval and manual adjustment.
 *
 * NOTE: The approve and adjust endpoints do NOT exist in the current backend:
 *   - POST /shifts/:id/distribution/approve  → not implemented
 *   - PATCH /tip-distributions/:id/adjust    → not implemented
 *
 * Both actions are rendered as disabled with "Bientôt disponible" badges.
 * When the backend adds these endpoints, remove the disabled state and wire
 * the mutations from distribution.api.ts.
 */
export function DistributionActions({ userRole }: DistributionActionsProps) {
  const canApprove = userRole === 'OWNER' || userRole === 'MANAGER';
  const canAdjust = userRole === 'OWNER';

  if (!canApprove && !canAdjust) return null;

  return (
    <div className="bg-st-card border border-st-border rounded-lg p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
          style={{ background: 'rgba(16,185,129,.12)', color: '#34D399' }}
        >
          <Lock size={14} />
        </div>
        <div>
          <div className="text-[13.5px] text-st-hi font-medium">Validation de la distribution</div>
          <div className="text-[12px] text-st-sec mt-0.5 leading-relaxed">
            Vérifiez les montants puis approuvez pour figer la distribution.
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        {/* Approve button — disabled (backend not ready) */}
        {canApprove && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
            <button
              disabled
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-[13px] font-medium cursor-not-allowed opacity-50"
              style={{
                background: '#10B981',
                color: 'white',
              }}
              title="Approuver la distribution — endpoint backend requis"
            >
              <CheckCircle size={15} />
              Approuver la distribution
            </button>
            <Badge tone="gold" className="self-start sm:self-auto">
              Bientôt disponible
            </Badge>
          </div>
        )}

        {/* Manual adjust — OWNER only, disabled */}
        {canAdjust && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <button
              disabled
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-[13px] font-medium border cursor-not-allowed opacity-50"
              style={{
                background: 'transparent',
                borderColor: '#3A4366',
                color: '#8892B0',
              }}
              title="Ajustement manuel — endpoint backend requis"
            >
              <Edit3 size={14} />
              Ajuster manuellement
            </button>
            <Badge tone="neutral" className="self-start sm:self-auto text-[10px]">
              OWNER seulement
            </Badge>
          </div>
        )}
      </div>

      {/* Info strip */}
      <div
        className="mt-4 p-3 rounded-sm flex items-start gap-2.5 text-[12px] text-st-sec leading-relaxed"
        style={{ background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.2)' }}
      >
        <span className="text-st-indigo-glow mt-0.5 shrink-0">ℹ</span>
        <span>
          Les fonctions d&apos;approbation et d&apos;ajustement manuel seront disponibles dans une
          prochaine version. Chaque modification sera tracée dans l&apos;audit log avec
          l&apos;auteur, l&apos;ancien montant, le nouveau montant et la raison.
        </span>
      </div>
    </div>
  );
}
