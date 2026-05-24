import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Menu Engineering — Optimisez vos marges',
  description: 'Gérez votre menu restaurant, catégories, prix et coûts.',
};

export default function MenuLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
