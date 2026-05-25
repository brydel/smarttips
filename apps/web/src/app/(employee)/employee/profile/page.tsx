'use client';

import { UserCircle, Building2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../../../hooks/use-auth';
import { useEmployeeProfile } from '../../../../features/employee/hooks/use-employee-profile';
import { EmployeeProfileForm } from '../../../../features/employee/components/EmployeeProfileForm';
import { EmployeePasswordForm } from '../../../../features/employee/components/EmployeePasswordForm';

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

export default function EmployeeProfilePage() {
  // Use AuthContext as primary — already hydrated, no extra request needed.
  const { user: authUser } = useAuth();
  const { data: profileData, isLoading } = useEmployeeProfile();

  // Prefer profile query data (more up-to-date), fall back to auth context.
  const user = profileData ?? authUser;

  if (isLoading && !authUser) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg
          className="animate-spin text-st-emerald"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-[13px] text-st-sec font-sans">Impossible de charger votre profil.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto w-full">
      {/* Profile hero */}
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div
          className="flex items-center justify-center rounded-2xl text-xl font-bold text-white font-mono shrink-0"
          style={{
            width: 56,
            height: 56,
            background: 'linear-gradient(135deg, #10B981, #059669)',
          }}
        >
          {getInitials(user.name)}
        </div>
        <div className="min-w-0">
          <h1 className="st-display text-[24px] sm:text-[28px] text-st-hi leading-none mb-1 truncate">
            {user.name}
          </h1>
          <div className="flex items-center flex-wrap gap-2 text-[11.5px] font-sans text-st-sec">
            <span>{user.email}</span>
            {user.tenantName && (
              <>
                <span className="text-st-dim">·</span>
                <span>{user.tenantName}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Info personnelles */}
      <EmployeeProfileForm user={user} />

      {/* Sécurité */}
      <EmployeePasswordForm />

      {/* Account info */}
      <div className="bg-st-card border border-st-border rounded-xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{ background: 'rgba(16,185,129,.1)', color: '#34D399' }}
          >
            <ShieldCheck size={13} />
          </div>
          <span className="text-[13px] font-medium text-st-hi font-sans">Mon compte</span>
        </div>

        <div className="flex flex-col gap-3">
          <AccountRow
            icon={<UserCircle size={12} className="text-st-dim" />}
            label="Rôle"
            value="Employé"
          />
          {user.tenantName && (
            <AccountRow
              icon={<Building2 size={12} className="text-st-dim" />}
              label="Restaurant"
              value={user.tenantName}
            />
          )}
          <AccountRow
            icon={<ShieldCheck size={12} className="text-st-dim" />}
            label="Statut"
            value="Compte actif"
            valueClass="text-st-emerald-glow"
          />
        </div>
      </div>
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function AccountRow({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-st-border last:border-0">
      <div className="flex items-center gap-2 text-[12.5px] text-st-sec font-sans">
        {icon}
        {label}
      </div>
      <span className={`text-[12.5px] font-sans font-medium ${valueClass ?? 'text-st-hi'}`}>
        {value}
      </span>
    </div>
  );
}
