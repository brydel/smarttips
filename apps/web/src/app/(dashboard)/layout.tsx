'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Menu } from 'lucide-react';
import { AuthProvider, type UserRole } from '../../contexts/auth.context';
import { useAuth } from '../../hooks/use-auth';
import { Sidebar } from '../../components/dashboard/sidebar';

/** Roles that may access the management dashboard. */
const MANAGEMENT_ROLES: ReadonlySet<UserRole> = new Set(['OWNER', 'MANAGER']);

function DashboardShell({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login?session=expired');
      return;
    }

    // RBAC: only OWNER and MANAGER may access the management dashboard.
    if (user && !MANAGEMENT_ROLES.has(user.role)) {
      router.replace('/login?reason=access_denied');
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-st-bg">
        <svg
          className="animate-spin text-st-indigo"
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

  // Block render until role check resolves (avoids flash of management UI for employees)
  if (!isAuthenticated || (user && !MANAGEMENT_ROLES.has(user.role))) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-st-bg md:flex-row">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex md:flex-col md:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
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
          {/* Sidebar panel */}
          <div id="mobile-sidebar" className="absolute left-0 top-0 h-full w-64 bg-st-bg shadow-lg">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Content column — fills remaining width on desktop, full width on mobile */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Mobile header — visible only on small screens */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-st-border bg-st-bg shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-st-indigo to-[#4338CA]">
              <Brain size={12} className="text-white" />
            </div>
            <span className="font-display text-sm text-st-hi">SmartTips</span>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-st-sec hover:text-st-hi hover:bg-st-raised transition-colors"
            aria-label="Ouvrir le menu"
            aria-expanded={sidebarOpen}
            aria-controls="mobile-sidebar"
          >
            <Menu size={18} />
          </button>
        </div>

        {/* Page content */}
        <main className="flex flex-1 flex-col overflow-hidden min-w-0">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
