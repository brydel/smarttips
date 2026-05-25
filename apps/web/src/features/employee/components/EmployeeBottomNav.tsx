'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, UserCircle } from 'lucide-react';
import { cn } from '../../../lib/cn';

const NAV_ITEMS = [
  { href: '/employee/dashboard', label: 'Accueil', icon: LayoutDashboard },
  { href: '/employee/shifts', label: 'Mes shifts', icon: CalendarDays },
  { href: '/employee/profile', label: 'Profil', icon: UserCircle },
] as const;

export function EmployeeBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      style={{
        background: 'rgba(10,14,26,.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid #1B2236',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      aria-label="Navigation employé"
    >
      <div className="flex items-stretch">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 py-3 transition-colors duration-150',
                isActive ? 'text-st-indigo-glow' : 'text-st-dim hover:text-st-sec',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} className="shrink-0" />
              <span
                className={cn('text-[10px] font-sans', isActive ? 'font-semibold' : 'font-normal')}
              >
                {label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-12 h-0.5 rounded-t-full bg-st-indigo-glow" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
