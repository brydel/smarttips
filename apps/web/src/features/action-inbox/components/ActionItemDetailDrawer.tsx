'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, EyeOff, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import type { ActionItem, UpdateActionItemStatusPayload } from '../types/action-inbox.types';
import {
  actionItemHref,
  formatEvidence,
  SEVERITY_CONFIG,
  STATUS_LABELS,
  TYPE_LABELS,
} from '../utils/action-inbox-labels';

interface ActionItemDetailDrawerProps {
  item: ActionItem | null;
  onClose: () => void;
  onUpdateStatus: (id: string, payload: UpdateActionItemStatusPayload) => Promise<unknown>;
  updating: boolean;
}

export function ActionItemDetailDrawer({
  item,
  onClose,
  onUpdateStatus,
  updating,
}: ActionItemDetailDrawerProps) {
  const [note, setNote] = useState('');

  // Réinitialise la note à chaque changement d'item.
  useEffect(() => {
    setNote('');
  }, [item?.id]);

  // Fermeture clavier (Escape).
  useEffect(() => {
    if (!item) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  if (!item) return null;

  const severity = SEVERITY_CONFIG[item.severity];
  const evidence = formatEvidence(item.payload);
  const href = actionItemHref(item);
  const isOpen = item.status === 'OPEN';

  const handleUpdate = async (status: 'RESOLVED' | 'DISMISSED') => {
    const trimmed = note.trim();
    await onUpdateStatus(item.id, {
      status,
      ...(trimmed ? { note: trimmed.slice(0, 500) } : {}),
    });
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'color-mix(in srgb, var(--st-bg) 55%, transparent)',
          zIndex: 40,
        }}
        aria-hidden="true"
      />

      {/* Panneau */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-item-drawer-title"
        className="w-full sm:w-[420px]"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          maxWidth: '100vw',
          background: 'var(--st-card)',
          borderLeft: '1px solid var(--st-border)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* En-tête */}
        <div
          className="px-5 pt-5 pb-4 border-b border-st-border shrink-0"
          style={{ background: `linear-gradient(135deg, ${severity.bg}, transparent)` }}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <span
              className="px-2 py-0.5 rounded-pill text-[10px] font-mono uppercase tracking-[0.05em] border"
              style={{
                color: severity.color,
                background: severity.bg,
                borderColor: severity.border,
              }}
            >
              {severity.label}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="p-1 rounded-[6px] transition-colors hover:bg-st-raised"
              style={{ color: 'var(--st-dim)', background: 'transparent', border: 'none' }}
            >
              <X size={16} />
            </button>
          </div>
          <h2
            id="action-item-drawer-title"
            className="text-[16px] font-medium leading-snug"
            style={{ color: 'var(--st-hi)' }}
          >
            {item.title}
          </h2>
          <p className="text-[11.5px] mt-1.5" style={{ color: 'var(--st-sec)' }}>
            {TYPE_LABELS[item.type]} · détectée le{' '}
            {format(new Date(item.createdAt), 'd MMMM yyyy', { locale: fr })}
          </p>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Évidences */}
          {evidence.length > 0 && (
            <section className="mb-5">
              <p
                className="uppercase tracking-[0.14em] font-mono text-[9.5px] font-medium mb-2.5"
                style={{ color: 'var(--st-dim)' }}
              >
                Évidences
              </p>
              <div className="rounded-[10px] border border-st-border overflow-hidden bg-st-raised">
                {evidence.map((entry, i) => (
                  <div
                    key={entry.label}
                    className="grid items-center px-3.5 py-2.5"
                    style={{
                      gridTemplateColumns: '130px 1fr',
                      borderBottom:
                        i === evidence.length - 1 ? 'none' : '1px solid var(--st-border)',
                    }}
                  >
                    <span className="text-[11px]" style={{ color: 'var(--st-dim)' }}>
                      {entry.label}
                    </span>
                    <span className="text-[12.5px]" style={{ color: 'var(--st-pri)' }}>
                      {entry.value}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Lien de traitement */}
          {href && (
            <section className="mb-5">
              <Link
                href={href}
                className="inline-flex items-center gap-1.5 text-[12.5px] hover:opacity-80 transition-opacity"
                style={{ color: 'var(--st-indigo-glow)', textDecoration: 'none' }}
              >
                Ouvrir le shift concerné <ArrowUpRight size={13} />
              </Link>
            </section>
          )}

          {/* Résolution */}
          {isOpen ? (
            <section>
              <p
                className="uppercase tracking-[0.14em] font-mono text-[9.5px] font-medium mb-2.5"
                style={{ color: 'var(--st-dim)' }}
              >
                Note de résolution (optionnelle)
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Contexte, décision, suivi…"
                className="w-full rounded-[10px] border border-st-border bg-st-raised p-3 text-[12.5px] resize-none focus:outline-none focus:border-st-muted"
                style={{ color: 'var(--st-hi)', fontFamily: 'inherit' }}
                aria-label="Note de résolution"
              />
            </section>
          ) : (
            <section>
              <p
                className="uppercase tracking-[0.14em] font-mono text-[9.5px] font-medium mb-2.5"
                style={{ color: 'var(--st-dim)' }}
              >
                Résolution
              </p>
              <div className="rounded-[10px] border border-st-border bg-st-raised p-3.5">
                <p className="text-[12.5px] mb-1" style={{ color: 'var(--st-pri)' }}>
                  {STATUS_LABELS[item.status]}
                  {item.resolvedAt
                    ? ` · ${format(new Date(item.resolvedAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}`
                    : ''}
                </p>
                <p
                  className="text-[12px] leading-relaxed"
                  style={{
                    color: item.resolutionNote ? 'var(--st-sec)' : 'var(--st-muted)',
                    fontStyle: item.resolutionNote ? 'normal' : 'italic',
                  }}
                >
                  {item.resolutionNote ?? 'Aucune note.'}
                </p>
              </div>
            </section>
          )}
        </div>

        {/* Pied : actions */}
        {isOpen && (
          <div className="border-t border-st-border px-5 py-3.5 flex items-center justify-end gap-2 shrink-0 bg-st-bg">
            <button
              type="button"
              onClick={() => void handleUpdate('DISMISSED')}
              disabled={updating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] text-[12.5px] border border-st-border hover:bg-st-raised transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              style={{ color: 'var(--st-sec)', background: 'transparent', fontFamily: 'inherit' }}
            >
              <EyeOff size={13} /> Ignorer
            </button>
            <button
              type="button"
              onClick={() => void handleUpdate('RESOLVED')}
              disabled={updating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-[12.5px] font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              style={{
                color: '#fff',
                background: updating ? '#3730A3' : '#6366F1',
                border: '1px solid transparent',
                fontFamily: 'inherit',
              }}
            >
              <Check size={13} /> {updating ? 'En cours…' : 'Résoudre'}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
