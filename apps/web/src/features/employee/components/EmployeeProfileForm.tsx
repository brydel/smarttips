'use client';

import { User } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import type { AuthUser } from '../../../contexts/auth.context';

interface EmployeeProfileFormProps {
  user: AuthUser;
}

export function EmployeeProfileForm({ user }: EmployeeProfileFormProps) {
  // Split name into first/last for display
  const nameParts = user.name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? '';
  const lastName = nameParts.slice(1).join(' ');

  return (
    <div className="bg-st-card border border-st-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-st-border">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{ background: 'rgba(99,102,241,.1)', color: '#818CF8' }}
          >
            <User size={13} />
          </div>
          <span className="text-[13px] font-medium text-st-hi font-sans">
            Informations personnelles
          </span>
        </div>
        <Badge tone="neutral">Lecture seule</Badge>
      </div>

      {/* Form */}
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldDisplay label="Prénom" value={firstName || '—'} />
          <FieldDisplay label="Nom" value={lastName || '—'} />
          <div className="sm:col-span-2">
            <FieldDisplay label="Adresse e-mail" value={user.email} />
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-st-border flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11.5px] text-st-dim font-sans leading-relaxed">
            Votre profil est consultable ici. Demandez une modification à votre gestionnaire.
          </p>
          <button
            type="button"
            disabled
            className="flex items-center gap-2 px-4 py-2.5 rounded-md text-[12.5px] font-medium font-sans cursor-not-allowed opacity-50"
            style={{
              background: 'rgba(99,102,241,.15)',
              border: '1px solid rgba(99,102,241,.3)',
              color: '#818CF8',
            }}
          >
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Static field display ──────────────────────────────────────────────────────

function FieldDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-st-sec font-sans">{label}</label>
      <div
        className="w-full bg-st-raised border border-st-border rounded-md px-3.5 py-[11px] text-sm text-st-hi font-sans opacity-70 cursor-not-allowed select-text"
        aria-readonly="true"
      >
        {value}
      </div>
    </div>
  );
}
