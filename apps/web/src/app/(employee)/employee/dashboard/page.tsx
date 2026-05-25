'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../../../../hooks/use-auth';
import { useEmployeeDashboard } from '../../../../features/employee/hooks/use-employee-dashboard';
import { EmployeeTipSummaryCards } from '../../../../features/employee/components/EmployeeTipSummaryCards';
import { EmployeeTipTrendChart } from '../../../../features/employee/components/EmployeeTipTrendChart';
import { EmployeeLastShiftCard } from '../../../../features/employee/components/EmployeeLastShiftCard';

// ── Greeting helper ───────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bonjour';
  return 'Bonsoir';
}

function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const { data: summary, notImplemented, isLoading, isError } = useEmployeeDashboard();

  const firstName = user ? getFirstName(user.name) : '';
  const greeting = getGreeting();

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      {/* Hero header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="st-display text-[32px] sm:text-[38px] text-st-hi leading-none mb-1">
            {greeting}, <span className="text-st-emerald-glow">{firstName}</span> 👋
          </h1>
          <p className="text-[13.5px] text-st-sec font-sans mt-2 leading-relaxed">
            Vos pourboires SmartTips, simplement.
          </p>
          {user?.tenantName && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10.5px] font-mono uppercase tracking-wider text-st-dim">
                {user.tenantName}
              </span>
              <span className="text-st-dim">·</span>
              <span className="text-[10.5px] font-mono text-st-dim">
                {new Date().toLocaleDateString('fr-CA', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
            </div>
          )}
        </div>

        {/* Role chip */}
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill shrink-0 self-start mt-1"
          style={{
            background: 'rgba(16,185,129,.08)',
            border: '1px solid rgba(16,185,129,.2)',
          }}
        >
          <Sparkles size={11} className="text-st-emerald-glow" />
          <span className="text-[11px] font-mono text-st-emerald-glow uppercase tracking-wider">
            Employé
          </span>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
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
      )}

      {/* Error */}
      {isError && !notImplemented && (
        <div className="rounded-xl border border-st-border bg-st-card p-5 text-center">
          <p className="text-[13px] text-st-sec font-sans">
            Impossible de charger vos données. Réessayez.
          </p>
        </div>
      )}

      {/* KPI cards */}
      <EmployeeTipSummaryCards summary={summary} notImplemented={notImplemented} />

      {/* Layout: chart + last shift */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* Trend chart */}
        <EmployeeTipTrendChart trend={summary?.trend30Days} notImplemented={notImplemented} />

        {/* Last shift */}
        <EmployeeLastShiftCard lastShift={summary?.lastShift} notImplemented={notImplemented} />
      </div>

      {/* CTA strip */}
      <div
        className="rounded-xl border p-4 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: 'rgba(99,102,241,.04)', borderColor: 'rgba(99,102,241,.15)' }}
      >
        <div>
          <p className="text-[13px] text-st-hi font-medium font-sans mb-0.5">
            Consulter mon historique complet
          </p>
          <p className="text-[11.5px] text-st-sec font-sans">
            Chaque shift, chaque pourboire, avec le détail du calcul.
          </p>
        </div>
        <Link
          href="/employee/shifts"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-[13px] font-medium font-sans shrink-0 transition-opacity hover:opacity-80"
          style={{
            background: 'rgba(99,102,241,.15)',
            border: '1px solid rgba(99,102,241,.3)',
            color: '#818CF8',
          }}
        >
          Voir mes shifts <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
