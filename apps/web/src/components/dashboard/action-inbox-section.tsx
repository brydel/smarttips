'use client';

import { ActionInboxPanel } from '../../features/action-inbox/components/ActionInboxPanel';

/**
 * Section "Boîte d'actions" du tableau de bord (BIS-54).
 * États de chargement/erreur/vide gérés par le panneau lui-même :
 * la section reste indépendante des stats du dashboard.
 */
export function ActionInboxSection() {
  return (
    <div className="mb-3.5">
      <ActionInboxPanel />
    </div>
  );
}
