'use client';

import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

import type { ActionItem, ActionItemSeverity } from '../types/action-inbox.types';
import { SEVERITY_CONFIG, STATUS_LABELS, TYPE_LABELS } from '../utils/action-inbox-labels';

const SEVERITY_ICONS: Record<ActionItemSeverity, React.ReactNode> = {
  CRITICAL: <AlertTriangle size={13} />,
  WARNING: <AlertCircle size={13} />,
  INFO: <Info size={13} />,
};

interface ActionItemRowProps {
  item: ActionItem;
  onSelect: (item: ActionItem) => void;
}

export function ActionItemRow({ item, onSelect }: ActionItemRowProps) {
  const severity = SEVERITY_CONFIG[item.severity];
  const age = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: fr });

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-left hover:bg-st-raised transition-colors border border-transparent hover:border-st-border cursor-pointer"
      style={{ fontFamily: 'inherit' }}
      aria-label={`Ouvrir le détail : ${item.title}`}
    >
      <span
        className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0"
        style={{ background: severity.bg, color: severity.color }}
        aria-hidden="true"
      >
        {SEVERITY_ICONS[item.severity]}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] truncate" style={{ color: 'var(--st-hi)' }}>
          {item.title}
        </p>
        <p className="text-[11px]" style={{ color: 'var(--st-dim)' }}>
          {TYPE_LABELS[item.type]} · {age}
        </p>
      </div>

      {item.status !== 'OPEN' && (
        <span
          className="shrink-0 px-2 py-0.5 rounded-pill text-[10px] font-mono uppercase tracking-[0.05em] border border-st-border"
          style={{ color: 'var(--st-sec)' }}
        >
          {STATUS_LABELS[item.status]}
        </span>
      )}

      <span
        className="shrink-0 px-2 py-0.5 rounded-pill text-[10px] font-mono uppercase tracking-[0.05em] border hidden sm:inline-block"
        style={{ color: severity.color, background: severity.bg, borderColor: severity.border }}
      >
        {severity.label}
      </span>

      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--st-dim)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
        aria-hidden="true"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}
