'use client';

import Link from 'next/link';
import { Users, TrendingUp } from 'lucide-react';
import type { TopEmployee } from '../../../types/dashboard';

const ROLE_LABEL: Record<string, string> = {
  SERVER: 'Serveur',
  BARTENDER: 'Bar',
  BUSSER: 'Aide de salle',
  COOK: 'Cuisine',
  CHEF: 'Chef',
  HOST: 'Accueil',
};

const ROLE_GRADIENT: Record<string, string> = {
  SERVER: 'linear-gradient(135deg, #4F46E5, #818CF8)',
  BARTENDER: 'linear-gradient(135deg, #D4A574, #E8C49A)',
  HOST: 'linear-gradient(135deg, #10B981, #34D399)',
  COOK: 'linear-gradient(135deg, #5A6485, #8892B0)',
  CHEF: 'linear-gradient(135deg, #3A4366, #5A6485)',
  BUSSER: 'linear-gradient(135deg, #5A6485, #8892B0)',
};

interface TopPerformersCardProps {
  employees: TopEmployee[];
}

export function TopPerformersCard({ employees }: TopPerformersCardProps) {
  const rows = employees.slice(0, 5);
  const isEmpty = rows.length === 0;

  return (
    <div className="rounded-[14px] border border-st-border bg-st-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={13} style={{ color: 'var(--st-d-7)' }} />
          <span
            className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium"
            style={{ color: 'var(--st-d-7)' }}
          >
            Meilleures performances
          </span>
        </div>
        <Link
          href="/dashboard/employees"
          className="text-[11.5px] hover:opacity-80 transition-opacity"
          style={{ color: 'var(--st-indigo-glow)', textDecoration: 'none' }}
        >
          Voir l&apos;équipe →
        </Link>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
          <TrendingUp size={20} style={{ color: 'var(--st-d-5)' }} aria-hidden="true" />
          <p className="text-[13px] font-medium" style={{ color: 'var(--st-d-8)' }}>
            Pas encore de données
          </p>
          <p className="text-[11.5px]" style={{ color: 'var(--st-d-6)' }}>
            Les performances s&apos;affichent dès qu&apos;il y a des commandes sur la période.
          </p>
        </div>
      ) : null}

      {/* Rows */}
      <div className={isEmpty ? 'hidden' : ''}>
        {rows.map((e, i) => {
          const initials = `${e.firstName[0] ?? ''}${e.lastName[0] ?? ''}`;
          const gradient = ROLE_GRADIENT[e.role] ?? ROLE_GRADIENT.SERVER;
          const score = e.fairnessScore;
          const isPrestige = score !== null && score >= 95;
          return (
            <Link
              key={e.id}
              href="/dashboard/employees"
              className="flex items-center gap-3 px-1 py-2.5 rounded-md hover:bg-st-raised transition-colors"
              style={{
                borderBottom: i < rows.length - 1 ? '1px solid var(--st-d-3)' : 'none',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              {/* Rank */}
              <span
                className="font-mono text-[12px] w-5 text-center shrink-0"
                style={{ color: 'var(--st-d-6)', fontVariantNumeric: 'tabular-nums' }}
              >
                {i + 1}
              </span>

              {/* Avatar */}
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ background: gradient }}
                aria-hidden="true"
              >
                {initials}
              </span>

              {/* Name + role */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] truncate" style={{ color: 'var(--st-d-9)' }}>
                  {e.firstName} {e.lastName}
                </p>
                <p className="text-[11px] capitalize" style={{ color: 'var(--st-d-6)' }}>
                  {ROLE_LABEL[e.role] ?? e.role} · {e.hoursWorked.toFixed(0)}h
                </p>
              </div>

              {/* Tips */}
              <span
                className="font-mono font-medium tabular-nums text-[14px] shrink-0"
                style={{ color: 'var(--st-d-9)' }}
              >
                ${e.tipsEstimated.toFixed(0)}
              </span>

              {/* Fairness badge */}
              {score !== null && (
                <span
                  className="font-mono text-[11px] px-1.5 py-0.5 rounded-pill shrink-0"
                  style={{
                    background: isPrestige ? 'rgba(212,165,116,.1)' : 'rgba(16,185,129,.08)',
                    color: isPrestige ? 'var(--st-gold)' : 'var(--st-emerald-glow)',
                    border: `1px solid ${isPrestige ? 'rgba(212,165,116,.3)' : 'rgba(16,185,129,.25)'}`,
                  }}
                >
                  {score}/100
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
