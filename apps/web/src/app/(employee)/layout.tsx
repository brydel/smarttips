'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../hooks/use-auth';
import { EmployeeSidebar } from '../../features/employee/components/EmployeeSidebar';
import { EmployeeBottomNav } from '../../features/employee/components/EmployeeBottomNav';

/** Roles that may access the employee personal space. */
const EMPLOYEE_ROLES: ReadonlySet<string> = new Set(['EMPLOYEE']);

function EmployeeShell({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login?session=expired');
      return;
    }

    // Non-employee users (OWNER/MANAGER) belong in the management dashboard.
    if (user && !EMPLOYEE_ROLES.has(user.role)) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, user, router]);

  // Loading spinner
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-st-bg">
        <svg
          className="animate-spin text-st-emerald"
          width="24"
          height="24"
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

  // Block render until role check resolves
  if (!isAuthenticated || (user && !EMPLOYEE_ROLES.has(user.role))) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-st-bg md:flex-row">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex md:flex-col md:shrink-0">
        <EmployeeSidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            role="button"
            tabIndex={0}
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                setSidebarOpen(false);
              }
            }}
          />
          <div
            id="mobile-employee-sidebar"
            className="absolute left-0 top-0 h-full w-60 bg-st-bg shadow-lg"
          >
            <EmployeeSidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Content column */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Mobile header */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-st-border bg-st-bg shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {user && (
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold text-white font-mono shrink-0"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
              >
                {user.name.trim().slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <span className="font-sans text-[12.5px] font-medium text-st-hi truncate block leading-none">
                {user?.name ?? 'Mon espace'}
              </span>
              {user?.tenantName && (
                <span className="font-mono text-[9.5px] text-st-dim block mt-0.5">
                  {user.tenantName}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-st-sec hover:text-st-hi hover:bg-st-raised transition-colors"
            aria-label="Ouvrir le menu"
            aria-expanded={sidebarOpen}
            aria-controls="mobile-employee-sidebar"
          >
            <Menu size={18} />
          </button>
        </div>

        {/* Page content — add pb-20 on mobile for bottom nav clearance */}
        <main className="flex flex-1 flex-col overflow-auto min-w-0 pb-20 md:pb-0">{children}</main>
      </div>

      {/* Mobile bottom nav — fixed at bottom */}
      <EmployeeBottomNav />
    </div>
  );
}

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  return <EmployeeShell>{children}</EmployeeShell>;
}
