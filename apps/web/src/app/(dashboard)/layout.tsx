'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, type UserRole } from '../../contexts/auth.context';
import { useAuth } from '../../hooks/use-auth';
import { Sidebar } from '../../components/dashboard/sidebar';

/** Roles that may access the management dashboard. */
const MANAGEMENT_ROLES: ReadonlySet<UserRole> = new Set(['OWNER', 'MANAGER']);

function DashboardShell({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

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
    <div className="flex h-screen overflow-hidden bg-st-bg">
      {/* Sidebar — hidden on mobile, shown via sheet on md+ */}
      <div className="hidden md:flex md:flex-col md:shrink-0">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
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
