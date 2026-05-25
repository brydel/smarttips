'use client';

import { Lock } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';

/**
 * Password change form.
 *
 * Disabled because PATCH /me/password is not yet implemented in the backend.
 * When the endpoint is added:
 *   1. Remove `disabled` attributes and "Bientôt disponible" badge
 *   2. Add react-hook-form + zod validation:
 *      - currentPassword: required
 *      - newPassword: min 8 chars, required
 *      - confirmPassword: must match newPassword
 *   3. Wire `onSubmit` to `useMutation(updateMyPassword)`
 *   4. Add show/hide toggles for each password field
 *   5. Clear fields on success and show toast
 */
export function EmployeePasswordForm() {
  return (
    <div className="bg-st-card border border-st-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-st-border">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{ background: 'rgba(239,68,68,.1)', color: '#EF4444' }}
          >
            <Lock size={13} />
          </div>
          <span className="text-[13px] font-medium text-st-hi font-sans">
            Sécurité · Mot de passe
          </span>
        </div>
        <Badge tone="neutral">Bientôt disponible</Badge>
      </div>

      {/* Form */}
      <div className="p-5">
        <div className="flex flex-col gap-4">
          <PasswordFieldDisplay label="Mot de passe actuel" />
          <PasswordFieldDisplay label="Nouveau mot de passe" />
          <PasswordFieldDisplay label="Confirmer le nouveau mot de passe" />
        </div>

        <div className="mt-5 pt-4 border-t border-st-border flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11.5px] text-st-dim font-sans leading-relaxed">
            La modification du mot de passe sera disponible dans une prochaine version.
          </p>
          <button
            type="button"
            disabled
            className="flex items-center gap-2 px-4 py-2.5 rounded-md text-[12.5px] font-medium font-sans cursor-not-allowed opacity-50"
            style={{
              background: 'rgba(239,68,68,.1)',
              border: '1px solid rgba(239,68,68,.25)',
              color: '#EF4444',
            }}
          >
            <Lock size={12} />
            Modifier le mot de passe
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Static password field display ─────────────────────────────────────────────

function PasswordFieldDisplay({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-st-sec font-sans">{label}</label>
      <div
        className="w-full bg-st-raised border border-st-border rounded-md px-3.5 py-[11px] text-sm text-st-dim font-mono opacity-60 cursor-not-allowed"
        aria-readonly="true"
        aria-label={label}
      >
        ••••••••
      </div>
    </div>
  );
}
