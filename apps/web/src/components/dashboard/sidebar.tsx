'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Brain,
  Calendar,
  FileText,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Shield,
  Split,
  UtensilsCrossed,
  Users,
  X,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuth } from '../../hooks/use-auth';
import { ThemeToggle } from '../theme/theme-toggle';
import { SidebarCard } from './sidebar/sidebar-card';
import { SidebarMLStatusCard } from './sidebar/sidebar-ml-status';
import { SidebarRoleBreakdown } from './sidebar/sidebar-role-breakdown';
import { useSidebarStats } from './sidebar/use-sidebar-stats';
import type { SidebarCardData } from './sidebar/types';

interface SidebarProps {
  onClose?: () => void;
}

/**
 * Static metadata for the workspace + configuration sections.
 * KPIs are merged from `useSidebarStats` at render time so static and dynamic
 * concerns stay clearly separated.
 */
const WORKSPACE_BLUEPRINT = [
  {
    href: '/dashboard',
    label: "Vue d'ensemble",
    caption: 'Performance globale',
    icon: LayoutDashboard,
    tone: 'indigo',
  },
  {
    href: '/dashboard/distributions',
    label: 'Distributions',
    caption: 'Pools de pourboires',
    icon: Split,
    tone: 'emerald',
  },
  {
    href: '/dashboard/reports',
    label: 'Reports',
    caption: 'Exports & audit',
    icon: FileText,
    tone: 'violet',
  },
  {
    href: '/dashboard/shifts',
    label: 'Shifts',
    caption: 'Services planifiés',
    icon: Calendar,
    tone: 'sky',
  },
  {
    href: '/dashboard/employees',
    label: 'Équipe',
    caption: 'Membres actifs',
    icon: Users,
    tone: 'amber',
  },
  {
    href: '/dashboard/menu',
    label: 'Menu',
    caption: 'Catalogue actif',
    icon: UtensilsCrossed,
    tone: 'rose',
  },
] as const satisfies ReadonlyArray<Omit<SidebarCardData, 'metric' | 'hint' | 'badge' | 'progress'>>;

const CONFIGURATION: ReadonlyArray<{
  href: string;
  label: string;
  caption: string;
  icon: typeof LayoutDashboard;
}> = [
  {
    href: '/dashboard/settings/distribution',
    label: 'Distribution',
    caption: 'Règles & méthodes',
    icon: Shield,
  },
];

/**
 * Match active route. For non-root routes we accept any prefix so child pages
 * (e.g. `/dashboard/shifts/[id]`) keep the parent card highlighted.
 */
function isItemActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ onClose }: SidebarProps = {}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const stats = useSidebarStats();

  /** Merge static cards with live KPIs once per stats update. */
  const workspaceCards = useMemo<SidebarCardData[]>(() => {
    const enrichmentByHref: Record<string, Partial<SidebarCardData>> = {
      '/dashboard': {
        metric: stats.tipsDeltaLabel,
        hint: 'vs hier · pourboires',
      },
      '/dashboard/distributions': {
        metric: stats.distributionsPending === null ? null : stats.distributionsPending.toString(),
        hint: stats.distributionsHint,
        badge:
          stats.distributionsPending && stats.distributionsPending > 0
            ? stats.distributionsPending.toString()
            : null,
      },
      '/dashboard/shifts': {
        metric: stats.tomorrowShiftsCount === null ? null : stats.tomorrowShiftsCount.toString(),
        hint: stats.shiftStatusLabel,
        progress: stats.liveShiftProgress,
      },
      '/dashboard/employees': {
        metric: stats.activeEmployees === null ? null : stats.activeEmployees.toString(),
        hint: stats.liveTeamCount !== null ? `${stats.liveTeamCount} en service` : 'membres actifs',
      },
      '/dashboard/menu': {
        metric: null,
        hint: 'Catalogue géré',
      },
    };

    return WORKSPACE_BLUEPRINT.map((card) => ({
      ...card,
      metric: null,
      ...enrichmentByHref[card.href],
    }));
  }, [stats]);

  return (
    <aside
      className={cn(
        'relative flex h-full w-72 flex-col overflow-hidden border-r border-st-border bg-st-bg',
        'before:pointer-events-none before:absolute before:inset-0',
        'before:bg-[radial-gradient(120%_60%_at_50%_0%,rgba(99,102,241,0.06),transparent_60%)]',
      )}
      aria-label="Navigation principale"
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'absolute right-3 top-3 z-10 rounded-md p-1.5 text-st-dim',
            'hover:bg-st-raised hover:text-st-hi md:hidden',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-st-indigo',
          )}
          aria-label="Fermer le menu"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}

      {/* Brand + tenant */}
      <div className="relative flex items-center gap-2.5 px-4 pb-3 pt-4">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            'bg-gradient-to-br from-[#6366F1] to-[#4338CA] text-white shadow-[0_4px_14px_-4px_rgba(99,102,241,0.6)]',
          )}
          aria-hidden="true"
        >
          <Brain size={15} />
        </div>
        <div className="min-w-0">
          <span className="block font-display text-[15px] leading-none tracking-tight text-st-hi">
            SmartTips
          </span>
          {user?.tenantName && (
            <span className="mt-0.5 block truncate font-mono text-[10px] leading-none text-st-dim">
              {user.tenantName}
            </span>
          )}
        </div>
      </div>

      {/* User profile card */}
      {user && (
        <div className="relative px-3 pb-3">
          <Link
            href="/dashboard/settings/distribution"
            onClick={onClose}
            className={cn(
              'group flex items-center gap-3 rounded-md border border-st-border bg-st-card px-3 py-2.5',
              'outline-none transition-colors hover:bg-st-raised',
              'focus-visible:ring-2 focus-visible:ring-st-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-st-bg',
            )}
          >
            <div className="relative shrink-0">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-md',
                  'bg-gradient-to-br from-[#6366F1] to-[#4338CA]',
                  'font-mono text-[12px] font-bold text-white shadow-sm',
                )}
              >
                {(user.name.trim().slice(0, 2) || '?').toUpperCase()}
              </div>
              <span
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-st-card bg-st-emerald"
                aria-label="En ligne"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-sans text-xs font-medium text-st-hi">{user.name}</p>
              <p className="mt-0.5 truncate font-mono text-[10px] text-st-dim">
                <span className="capitalize">{user.role.toLowerCase()}</span>
                {user.tenantName ? ` · ${user.tenantName}` : ''}
              </p>
            </div>
            <ChevronRight
              size={12}
              className="shrink-0 text-st-dim transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      )}

      {/* Theme toggle — tri-state Clair / Auto / Sombre */}
      <div className="relative px-3 pb-3">
        <ThemeToggle />
      </div>

      {/* Scrollable nav */}
      <nav
        className={cn(
          'relative flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3',
          '[scrollbar-width:thin] [scrollbar-color:var(--st-stroke)_transparent]',
        )}
      >
        <p className="mb-2 mt-1 px-1 font-mono text-[9.5px] uppercase tracking-widest text-st-dim">
          Espaces
        </p>
        <div className="space-y-2">
          {workspaceCards.map((card) => (
            <SidebarCard
              key={card.href}
              {...card}
              isActive={isItemActive(pathname, card.href)}
              onNavigate={onClose}
            />
          ))}

          <SidebarRoleBreakdown
            rows={stats.roleBreakdown}
            isActive={isItemActive(pathname, '/dashboard/categories')}
            href="/dashboard/categories"
            onNavigate={onClose}
          />
        </div>

        <p className="mb-2 mt-5 px-1 font-mono text-[9.5px] uppercase tracking-widest text-st-dim">
          Configuration
        </p>
        <ul className="space-y-1">
          {CONFIGURATION.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-md border border-transparent px-2.5 py-2',
                    'font-sans text-[12.5px] outline-none transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-st-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-st-bg',
                    active
                      ? 'border-st-border bg-st-raised text-st-hi'
                      : 'text-st-sec hover:border-st-border hover:bg-st-raised/60 hover:text-st-pri',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-sm',
                      active
                        ? 'bg-st-stroke text-st-hi'
                        : 'bg-st-card text-st-dim group-hover:text-st-pri',
                    )}
                    aria-hidden="true"
                  >
                    <Icon width={13} height={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] leading-tight">{item.label}</p>
                    <p className="mt-0.5 truncate font-mono text-[9.5px] text-st-dim">
                      {item.caption}
                    </p>
                  </div>
                  <ChevronRight
                    size={11}
                    className="shrink-0 text-st-dim transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-5">
          <SidebarMLStatusCard
            confidence={null}
            impactLabel="Distribution équitable des pourboires"
          />
        </div>
      </nav>

      {/* Logout — pinned bottom */}
      <button
        type="button"
        onClick={() => logout()}
        className={cn(
          'flex items-center gap-2.5 border-t border-st-border px-5 py-3.5',
          'font-sans text-[12.5px] text-st-sec outline-none transition-colors',
          'hover:bg-st-raised/50 hover:text-st-hi',
          'focus-visible:ring-2 focus-visible:ring-st-indigo',
        )}
      >
        <LogOut size={14} aria-hidden="true" />
        Déconnexion
      </button>
    </aside>
  );
}
