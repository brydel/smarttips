'use client';

import { memo } from 'react';
import { Tag } from 'lucide-react';
import Link from 'next/link';
import { cn } from '../../../lib/cn';
import type { RoleBreakdown } from '../../../types/dashboard';

interface SidebarRoleBreakdownProps {
  rows: RoleBreakdown[];
  isActive: boolean;
  href: string;
  onNavigate?: () => void;
}

/** Translate API hex (possibly nullish) into a safe CSS colour. */
function safeColor(hex: string | undefined | null): string {
  if (!hex || !/^#[0-9a-f]{3,8}$/i.test(hex)) return '#818CF8';
  return hex;
}

function SidebarRoleBreakdownImpl({ rows, isActive, href, onNavigate }: SidebarRoleBreakdownProps) {
  const hasData = rows.length > 0;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'st-sidebar-tone-card group block rounded-lg border border-[#14B8A6]/30 p-3',
        'bg-gradient-to-br from-[#134E4A]/65 via-[#0F1422]/60 to-[#0F1422]/0',
        'outline-none transition-[box-shadow,transform,border-color] duration-200 ease-out',
        'focus-visible:ring-2 focus-visible:ring-st-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-st-bg',
        'group-hover:shadow-[0_8px_24px_-12px_rgba(20,184,166,0.45)]',
        isActive && 'ring-1 ring-[#14B8A6]/60 shadow-[0_8px_28px_-10px_rgba(20,184,166,0.4)]',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#0D9488]/25 text-[#5EEAD4]"
          aria-hidden="true"
        >
          <Tag width={16} height={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-sans text-[13px] font-semibold leading-tight text-st-hi">
            Catégories
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-st-dim">
            Répartition équipe
          </p>
        </div>
      </div>

      {hasData ? (
        <ul className="mt-3 space-y-1.5">
          {rows.map((row) => {
            const color = safeColor(row.color);
            const share = Math.max(0, Math.min(1, row.share));
            const pctLabel = `${Math.round(share * 100)} %`;
            return (
              <li key={row.role} className="flex items-center gap-2">
                <span className="w-12 truncate font-sans text-[10.5px] text-st-pri">
                  {row.label}
                </span>
                <div className="relative h-1 flex-1 overflow-hidden rounded-pill bg-white/5">
                  <div
                    className="h-full rounded-pill transition-[width] duration-500 ease-out motion-reduce:transition-none"
                    style={{ width: pctLabel, backgroundColor: color }}
                    role="progressbar"
                    aria-valuenow={Math.round(share * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${row.label} ${pctLabel}`}
                  />
                </div>
                <span className="w-9 text-right font-mono text-[10px] tabular-nums text-st-sec">
                  {pctLabel}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 font-sans text-[10.5px] text-st-sec">Aucune donnée disponible</p>
      )}
    </Link>
  );
}

export const SidebarRoleBreakdown = memo(SidebarRoleBreakdownImpl);
