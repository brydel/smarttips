'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Split,
  Users,
  Sparkles,
  UtensilsCrossed,
  Tag,
  Shield,
  Zap,
  Settings,
  LogOut,
  ChevronRight,
  Brain,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuth } from '../../hooks/use-auth';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: string;
  badgeTone?: 'gold' | 'indigo' | 'neutral';
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard', label: "Vue d'ensemble", icon: <LayoutDashboard size={15} /> },
      {
        href: '/dashboard/distributions',
        label: 'Distributions',
        icon: <Split size={15} />,
        badge: '2',
        badgeTone: 'neutral',
      },
      { href: '/dashboard/employees', label: 'Équipe', icon: <Users size={15} /> },
      {
        href: '/dashboard/ai-insights',
        label: 'AI Insights',
        icon: <Sparkles size={15} />,
        badge: '3',
        badgeTone: 'gold',
      },
      { href: '/dashboard/menu', label: 'Menu', icon: <UtensilsCrossed size={15} /> },
      { href: '/dashboard/categories', label: 'Catégories', icon: <Tag size={15} /> },
    ],
  },
  {
    label: 'Configurer',
    items: [
      { href: '/dashboard/tip-policy', label: 'Politique tips', icon: <Shield size={15} /> },
      { href: '/dashboard/integrations', label: 'Intégrations', icon: <Zap size={15} /> },
      { href: '/dashboard/settings', label: 'Paramètres', icon: <Settings size={15} /> },
    ],
  },
];

function NavLink({ href, label, icon, badge, badgeTone }: NavItem) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const badgeClass = {
    gold: 'bg-st-gold/15 text-st-gold-glow',
    indigo: 'bg-st-indigo/15 text-st-indigo-glow',
    neutral: 'bg-st-raised text-st-sec',
  }[badgeTone ?? 'neutral'];

  return (
    <Link
      href={href}
      className={cn(
        'relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm',
        'font-sans transition-colors duration-150 outline-none',
        'focus-visible:ring-2 focus-visible:ring-st-indigo',
        isActive
          ? 'bg-st-raised text-st-hi'
          : 'text-st-sec hover:bg-st-raised/60 hover:text-st-pri',
      )}
    >
      {isActive && (
        <span className="absolute left-[-14px] top-[8px] bottom-[8px] w-0.5 rounded-r bg-st-indigo" />
      )}
      <span className={cn(isActive ? 'text-st-hi' : 'text-st-dim')}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-pill', badgeClass)}>
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-st-border bg-st-bg">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-st-indigo to-[#4338CA] shadow-indigo">
          <Brain size={14} className="text-white" />
        </div>
        <span className="font-display text-base tracking-tight text-st-hi">SmartTips</span>
      </div>

      {/* Tenant switcher */}
      {user && (
        <button
          className={cn(
            'mx-3 mb-4 flex items-center gap-3 rounded-md px-3 py-2.5',
            'bg-st-card border border-st-border',
            'text-left transition-colors hover:bg-st-raised',
          )}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-st-indigo/20 text-[11px] font-bold text-st-indigo-glow font-mono">
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-st-hi truncate font-sans">{user.name}</p>
            <p className="text-[10.5px] text-st-sec capitalize font-sans">
              {user.role.toLowerCase()}
            </p>
          </div>
          <ChevronRight size={12} className="text-st-dim" />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-[14px] space-y-4">
        {NAV.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-2 font-mono text-[9.5px] uppercase tracking-widest text-st-dim">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Model status */}
      <div className="m-3 rounded-md border border-st-border bg-st-card p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <Sparkles size={11} className="text-st-gold" />
          <span className="font-mono text-[9.5px] uppercase tracking-widest text-st-gold">
            Modèle ML
          </span>
        </div>
        <p className="text-xs font-medium text-st-hi font-sans">En apprentissage</p>
        <p className="text-[10.5px] text-st-sec font-sans">Mis à jour il y a 4 min</p>
      </div>

      {/* Logout */}
      <button
        onClick={() => logout()}
        className="flex items-center gap-2.5 px-5 py-4 text-sm text-st-sec hover:text-st-hi transition-colors font-sans border-t border-st-border"
      >
        <LogOut size={14} />
        Déconnexion
      </button>
    </aside>
  );
}
