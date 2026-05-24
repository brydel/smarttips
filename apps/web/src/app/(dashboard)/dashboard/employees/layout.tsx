import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Équipe — Gestion des employés',
  description: 'Gérez votre équipe restaurant, rôles et coefficients de pourboires.',
};

export default function EmployeesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
