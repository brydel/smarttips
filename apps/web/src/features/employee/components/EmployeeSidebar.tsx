'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, UserCircle, LogOut, Brain } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { useAuth } from '../../../hooks/use-auth';

const NAV_ITEMS = [
  { href: '/employee/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/employee/shifts', label: 'Mes shifts', icon: CalendarDays },
  { href: '/employee/profile', label: 'Mon profil', icon: UserCircle },
] as const;

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

interface EmployeeSidebarProps {
  onClose?: () => void;
}

export function EmployeeSidebar({ onClose }: EmployeeSidebarProps = {}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <aside className="relative flex h-full w-60 flex-col border-r border-st-border bg-st-bg">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 shrink-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-st-emerald to-[#059669]">
          <Brain size={13} className="text-white" />
        </div>
        <div className="min-w-0">
          <span className="font-display text-sm tracking-tight text-st-hi leading-none block">
            SmartTips
          </span>
          {user?.tenantName && (
            <span className="font-mono text-[9.5px] text-st-dim truncate block mt-0.5 leading-none">
              {user.tenantName}
            </span>
          )}
        </div>
      </div>

      {/* User card */}
      {user && (
        <div className="mx-3 mb-4 flex items-center gap-3 rounded-md px-3 py-2.5 bg-st-card border border-st-border shrink-0">
          <div className="relative shrink-0">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-md text-[12px] font-bold text-white font-mono"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
            >
              {getInitials(user.name)}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-st-emerald border-2 border-st-card" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-st-hi truncate font-sans">{user.name}</p>
            <p className="text-[10px] text-st-dim truncate font-mono mt-0.5">
              Employé · {user.tenantName}
            </p>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3.5 space-y-0.5" aria-label="Navigation">
        <p className="mb-1.5 px-2 font-mono text-[9.5px] uppercase tracking-widest text-st-dim">
          Mon espace
        </p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm',
                'font-sans transition-colors duration-150 outline-none',
                'focus-visible:ring-2 focus-visible:ring-st-emerald',
                isActive
                  ? 'bg-st-raised text-st-hi'
                  : 'text-st-sec hover:bg-st-raised/60 hover:text-st-pri',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span className="absolute left-[-14px] top-[8px] bottom-[8px] w-0.5 rounded-r bg-st-emerald" />
              )}
              <Icon size={15} className={cn(isActive ? 'text-st-emerald-glow' : 'text-st-dim')} />
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={() => logout()}
        className="flex items-center gap-2.5 px-5 py-4 text-sm text-st-sec hover:text-st-hi transition-colors font-sans border-t border-st-border shrink-0"
        type="button"
      >
        <LogOut size={14} />
        Déconnexion
      </button>
    </aside>
  );
}
