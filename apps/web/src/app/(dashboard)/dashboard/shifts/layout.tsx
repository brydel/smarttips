import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Shifts — Gestion des services',
  description: 'Planifiez et gérez vos shifts de restaurant, équipes et commandes.',
};

export default function ShiftsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
