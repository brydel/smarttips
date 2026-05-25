'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { RefreshCw, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useDistributionConfig } from '../hooks/use-distribution-config';
import { DistributionModeSelector } from './DistributionModeSelector';
import { RoleCoefficientEditor } from './RoleCoefficientEditor';
import { DistributionGuardrailsCard } from './DistributionGuardrailsCard';
import { AdvancedOptionsCard } from './AdvancedOptionsCard';
import { DistributionSimulationCard } from './DistributionSimulationCard';
import { DistributionSaveBar } from './DistributionSaveBar';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import type {
  DistributionConfig,
  DistributionValidationErrors,
  RoleName,
  UpdateDistributionConfigPayload,
  ConfigEditableKey,
} from '../types/tenant-config.types';
import { DEFAULT_DISTRIBUTION_CONFIG, ROLE_NAMES } from '../types/tenant-config.types';

// ── Helpers ───────────────────────────────────────────────────────────────

function countDirtyFields(a: DistributionConfig, b: DistributionConfig): number {
  let n = 0;
  for (const role of ROLE_NAMES) {
    if (Math.abs(a.roleCoefficients[role] - b.roleCoefficients[role]) > 0.00001) n++;
  }
  if (Math.abs(a.minPerHour - b.minPerHour) > 0.00001) n++;
  if (a.maxSharePct !== b.maxSharePct) n++;
  if (Math.abs(a.salesBonusWeight - b.salesBonusWeight) > 0.00001) n++;
  if (a.tenureBonusEnabled !== b.tenureBonusEnabled) n++;
  if (a.fairnessAuditEnabled !== b.fairnessAuditEnabled) n++;
  if (a.coldStartThreshold !== b.coldStartThreshold) n++;
  return n;
}

function buildPayload(
  original: DistributionConfig,
  draft: DistributionConfig,
): UpdateDistributionConfigPayload {
  const payload: UpdateDistributionConfigPayload = {};
  const changedCoefs: Partial<Record<RoleName, number>> = {};
  let hasCoef = false;

  for (const role of ROLE_NAMES) {
    if (Math.abs(draft.roleCoefficients[role] - original.roleCoefficients[role]) > 0.00001) {
      changedCoefs[role] = draft.roleCoefficients[role];
      hasCoef = true;
    }
  }
  if (hasCoef) payload.roleCoefficients = changedCoefs;
  if (Math.abs(draft.minPerHour - original.minPerHour) > 0.00001)
    payload.minPerHour = draft.minPerHour;
  if (draft.maxSharePct !== original.maxSharePct) payload.maxSharePct = draft.maxSharePct;
  if (Math.abs(draft.salesBonusWeight - original.salesBonusWeight) > 0.00001)
    payload.salesBonusWeight = draft.salesBonusWeight;
  if (draft.tenureBonusEnabled !== original.tenureBonusEnabled)
    payload.tenureBonusEnabled = draft.tenureBonusEnabled;
  if (draft.fairnessAuditEnabled !== original.fairnessAuditEnabled)
    payload.fairnessAuditEnabled = draft.fairnessAuditEnabled;
  if (draft.coldStartThreshold !== original.coldStartThreshold)
    payload.coldStartThreshold = draft.coldStartThreshold;
  return payload;
}

function validate(draft: DistributionConfig): DistributionValidationErrors {
  const errs: DistributionValidationErrors = {};
  for (const role of ROLE_NAMES) {
    const v = draft.roleCoefficients[role];
    if (v < 0.1 || v > 2.0) errs[role] = 'Le coefficient doit être entre 0,1 et 2,0.';
  }
  if (draft.minPerHour < 0 || draft.minPerHour > 50)
    errs.minPerHour = 'Le minimum horaire doit être entre 0 $ et 50 $.';
  if (draft.maxSharePct < 1 || draft.maxSharePct > 100)
    errs.maxSharePct = 'Le plafond doit être entre 1 % et 100 %.';
  if (draft.salesBonusWeight < 0 || draft.salesBonusWeight > 1)
    errs.salesBonusWeight = 'Le poids des ventes doit être entre 0 et 1.';
  if (draft.coldStartThreshold < 1 || draft.coldStartThreshold > 365)
    errs.coldStartThreshold = 'Le seuil cold start doit être entre 1 et 365 jours.';
  return errs;
}

// ── Props ─────────────────────────────────────────────────────────────────

interface DistributionConfigFormProps {
  isOwner: boolean;
}

// ── Main component ────────────────────────────────────────────────────────

export function DistributionConfigForm({ isOwner }: DistributionConfigFormProps) {
  const { config, isLoading, isError, refetch, save, isSaving } = useDistributionConfig();

  const [draft, setDraft] = useState<DistributionConfig | null>(null);
  const [original, setOriginal] = useState<DistributionConfig | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [errors, setErrors] = useState<DistributionValidationErrors>({});

  // Initialize once when API data loads
  useEffect(() => {
    if (config && !original) {
      setOriginal(config);
      setDraft(config);
    }
  }, [config, original]);

  const dirtyCount = useMemo(
    () => (draft && original ? countDirtyFields(original, draft) : 0),
    [draft, original],
  );
  const isDirty = dirtyCount > 0;

  // ── Handlers ────────────────────────────────────────────────────────────

  const setCoef = useCallback((role: RoleName, value: number) => {
    setDraft((d) => (d ? { ...d, roleCoefficients: { ...d.roleCoefficients, [role]: value } } : d));
  }, []);

  const setField = useCallback((key: ConfigEditableKey, value: boolean | number) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }, []);

  const handleSave = useCallback(async () => {
    if (!draft || !original) return;
    const errs = validate(draft);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error('Veuillez corriger les erreurs de saisie avant de sauvegarder.');
      return;
    }
    setErrors({});
    const payload = buildPayload(original, draft);
    try {
      const updated = await save(payload);
      setOriginal(updated);
    } catch {
      // Error already shown by hook
    }
  }, [draft, original, save]);

  const handleDiscard = useCallback(() => {
    if (original) {
      setDraft(original);
      setErrors({});
      toast('Modifications annulées.', {
        description: 'Retour à la dernière configuration sauvegardée.',
      });
    }
  }, [original]);

  const handleReset = useCallback(() => {
    setDraft({ ...DEFAULT_DISTRIBUTION_CONFIG, updatedAt: null, source: 'DEFAULT' });
    setErrors({});
    toast('Valeurs par défaut restaurées.', {
      description: 'Cliquez "Sauvegarder" pour appliquer.',
    });
    setResetDialogOpen(false);
  }, []);

  // ── Loading / Error ──────────────────────────────────────────────────────
  // Check isError first — when fetch fails, draft/original stay null forever
  // and the loading guard would permanently block the error UI.

  if (isError && !draft) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <p className="text-[13px] text-st-hi font-medium mb-1">
            Impossible de charger la configuration de distribution.
          </p>
          <p className="text-[11.5px] text-st-sec mb-4">Vérifiez votre connexion et réessayez.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 text-[13px] rounded-md bg-st-card border border-st-border text-st-hi hover:bg-st-raised transition-colors font-sans"
          >
            <RefreshCw size={14} /> Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !draft || !original) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <svg
            className="animate-spin text-st-indigo mx-auto mb-3"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <p className="text-[13px] text-st-sec font-sans">Chargement de la configuration…</p>
        </div>
      </div>
    );
  }

  const readOnly = !isOwner;
  const isCustom = draft.source === 'CUSTOM';

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto">
          {/* Page header */}
          <div className="mb-5 sm:mb-7">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[12.5px] mb-3 text-st-sec font-sans">
              <span>Configurer</span>
              <span className="text-st-muted">›</span>
              <span className="text-st-hi">Distribution</span>
            </div>

            <div className="flex flex-wrap items-start gap-3 sm:gap-4 mb-2">
              <h1 className="font-display text-[28px] sm:text-[36px] text-st-hi leading-none">
                Politique de <em className="italic text-st-sec">distribution.</em>
              </h1>
              {/* Source badge */}
              {isCustom ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[11px] font-medium bg-st-emerald/10 border border-st-emerald/30 text-st-emerald-glow self-center">
                  ✓ Configuration personnalisée
                  {draft.updatedAt && (
                    <span className="text-st-sec font-mono text-[10px] ml-1">
                      ·{' '}
                      {formatDistanceToNow(new Date(draft.updatedAt), {
                        locale: fr,
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[11px] font-medium bg-st-raised border border-st-border text-st-sec self-center">
                  Valeurs par défaut
                </span>
              )}
            </div>

            <p className="text-[13.5px] text-st-sec max-w-[620px] leading-relaxed">
              Configurez les règles utilisées pour répartir les pourboires entre les employés
              d&apos;un shift.
            </p>
          </div>

          {/* Read-only banner */}
          {readOnly && (
            <div className="mb-5 flex items-start gap-3 p-3.5 rounded-md bg-st-raised border border-st-border">
              <Lock size={14} className="text-st-sec mt-0.5 flex-shrink-0" />
              <p className="text-[12.5px] text-st-sec leading-relaxed">
                <strong className="text-st-hi">Lecture seule</strong> — seul le propriétaire peut
                modifier les règles de distribution.
              </p>
            </div>
          )}

          {/* Two-column grid: sections left, simulator right */}
          <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
            {/* Left — config sections */}
            <div className="flex flex-col gap-4 min-w-0">
              <DistributionModeSelector readOnly={readOnly} />
              <RoleCoefficientEditor
                values={draft.roleCoefficients}
                original={original.roleCoefficients}
                onChange={setCoef}
                readOnly={readOnly}
                errors={errors}
              />
              <DistributionGuardrailsCard
                config={draft}
                original={original}
                onChange={setField}
                readOnly={readOnly}
                errors={errors}
              />
              <AdvancedOptionsCard
                config={draft}
                original={original}
                onChange={setField}
                readOnly={readOnly}
                errors={errors}
              />
            </div>

            {/* Right — sticky simulator */}
            <div className="min-w-0">
              <div className="xl:sticky xl:top-4">
                <DistributionSimulationCard config={draft} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save bar — outside scroll container, always visible at bottom */}
      {isOwner && (
        <DistributionSaveBar
          visible={isDirty}
          dirtyCount={dirtyCount}
          isSaving={isSaving}
          onSave={handleSave}
          onDiscard={handleDiscard}
          onReset={() => setResetDialogOpen(true)}
        />
      )}

      {/* Reset confirmation dialog */}
      <ConfirmDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        onConfirm={handleReset}
        title="Restaurer les valeurs par défaut ?"
        description="Tous les coefficients, garde-fous et règles redeviendront les valeurs par défaut de SmartTips. Votre configuration actuelle sera conservée jusqu'à la prochaine sauvegarde — vous pouvez encore l'annuler."
        confirmLabel="Restaurer"
      />
    </div>
  );
}
