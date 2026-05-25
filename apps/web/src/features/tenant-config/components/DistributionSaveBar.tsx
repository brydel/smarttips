'use client';

import { Save, RotateCcw, X } from 'lucide-react';
import { cn } from '../../../lib/cn';

interface DistributionSaveBarProps {
  visible: boolean;
  dirtyCount: number;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onReset: () => void;
}

export function DistributionSaveBar({
  visible,
  dirtyCount,
  isSaving,
  onSave,
  onDiscard,
  onReset,
}: DistributionSaveBarProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        'flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3',
        'px-4 sm:px-6 lg:px-8 py-3.5',
        'border-t border-st-border',
        'bg-st-bg/95 backdrop-blur-md',
        // Animate in
        'animate-in slide-in-from-bottom-2 duration-200',
      )}
      role="region"
      aria-label="Barre d'actions non sauvegardées"
    >
      {/* Dirty indicator */}
      <div className="flex items-center gap-2 sm:mr-auto">
        <span className="w-1.5 h-1.5 rounded-full bg-st-emerald-glow animate-pulse" />
        <span className="text-[11.5px] font-mono text-st-emerald-glow bg-st-emerald/10 border border-st-emerald/30 px-2.5 py-1 rounded-pill">
          {dirtyCount} modification{dirtyCount > 1 ? 's' : ''} non sauvegardée
          {dirtyCount > 1 ? 's' : ''}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Restore defaults */}
        <button
          type="button"
          onClick={onReset}
          disabled={isSaving}
          className={cn(
            'inline-flex items-center justify-center gap-1.5',
            'px-3 py-2 sm:py-2.5 rounded-md text-[12.5px] font-medium font-sans',
            'text-st-sec border border-st-border bg-transparent',
            'hover:bg-st-raised hover:text-st-hi transition-colors duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-st-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-st-bg',
          )}
        >
          <RotateCcw size={13} />
          <span className="hidden sm:inline">Restaurer les défauts</span>
          <span className="sm:hidden">Défauts</span>
        </button>

        {/* Discard */}
        <button
          type="button"
          onClick={onDiscard}
          disabled={isSaving}
          className={cn(
            'inline-flex items-center justify-center gap-1.5',
            'px-3 py-2 sm:py-2.5 rounded-md text-[12.5px] font-medium font-sans',
            'text-st-hi border border-st-border bg-transparent',
            'hover:bg-st-raised transition-colors duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-st-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-st-bg',
          )}
        >
          <X size={13} />
          <span className="hidden sm:inline">Annuler les modifications</span>
          <span className="sm:hidden">Annuler</span>
        </button>

        {/* Save */}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className={cn(
            'inline-flex items-center justify-center gap-2',
            'px-4 sm:px-5 py-2 sm:py-2.5 rounded-md text-[13.5px] font-medium font-sans',
            'bg-st-indigo text-white min-w-[120px] sm:min-w-[140px]',
            'hover:bg-st-indigo-dim transition-colors duration-150',
            'shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_1px_2px_rgba(0,0,0,.3)]',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-st-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-st-bg',
          )}
        >
          {isSaving ? (
            <>
              <svg
                className="animate-spin"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Sauvegarde…
            </>
          ) : (
            <>
              <Save size={14} />
              Sauvegarder
            </>
          )}
        </button>
      </div>
    </div>
  );
}
