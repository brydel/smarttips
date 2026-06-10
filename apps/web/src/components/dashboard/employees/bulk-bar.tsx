'use client';

import { X, Users, Archive } from 'lucide-react';

interface BulkBarProps {
  count: number;
  onDismiss: () => void;
  onArchive: () => void;
}

export function BulkBar({ count, onDismiss, onArchive }: BulkBarProps) {
  if (count === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label={`${count} employé${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}`}
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--st-raised)',
        border: '1px solid var(--st-stroke)',
        borderRadius: 12,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 80,
        boxShadow: '0 8px 32px -8px rgba(0,0,0,.6)',
        backdropFilter: 'blur(8px)',
        animation: 'shifts-fade-up .22s cubic-bezier(.2,.7,.3,1)',
      }}
    >
      {/* Count badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#6366F1',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--st-font-mono, monospace)',
          }}
        >
          {count}
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--st-pri)' }}>
          sélectionné{count > 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--st-stroke)' }} />

      {/* Actions */}
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 7,
          background: 'transparent',
          border: '1px solid var(--st-stroke)',
          color: 'var(--st-sec)',
          fontSize: 12.5,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all .15s ease',
        }}
        aria-label="Changer le rôle des employés sélectionnés (à venir)"
        title="Fonctionnalité à venir"
        onMouseEnter={(e) => {
          const b = e.currentTarget;
          b.style.color = 'var(--st-hi)';
          b.style.borderColor = 'var(--st-muted)';
        }}
        onMouseLeave={(e) => {
          const b = e.currentTarget;
          b.style.color = 'var(--st-sec)';
          b.style.borderColor = 'var(--st-stroke)';
        }}
      >
        <Users size={12} />
        Changer rôle
      </button>

      <button
        onClick={onArchive}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 7,
          background: 'rgba(239,68,68,.08)',
          border: '1px solid rgba(239,68,68,.25)',
          color: '#EF4444',
          fontSize: 12.5,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all .15s ease',
        }}
        aria-label="Archiver les employés sélectionnés"
        onMouseEnter={(e) => {
          const b = e.currentTarget;
          b.style.background = 'rgba(239,68,68,.15)';
        }}
        onMouseLeave={(e) => {
          const b = e.currentTarget;
          b.style.background = 'rgba(239,68,68,.08)';
        }}
      >
        <Archive size={12} />
        Archiver
      </button>

      <button
        onClick={onDismiss}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--st-dim)',
          padding: 4,
          borderRadius: 6,
          transition: 'color .15s ease',
        }}
        aria-label="Annuler la sélection"
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--st-hi)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--st-dim)';
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
