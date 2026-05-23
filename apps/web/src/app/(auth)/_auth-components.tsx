'use client';

import { forwardRef } from 'react';
import type { InputHTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { cn } from '../../lib/cn';

// ── Logo ─────────────────────────────────────────────────────────────────────
export function LogoMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-st-indigo to-[#4338CA] shadow-[0_2px_8px_rgba(99,102,241,.4)]">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      <span className="font-display text-base text-st-hi tracking-[-0.02em] font-normal">
        SmartTips
      </span>
    </div>
  );
}

// ── Employee Avatar ───────────────────────────────────────────────────────────
const AVATAR_COLORS: Record<string, string> = {
  bar: '#6366F1',
  server: '#10B981',
  host: '#D4A574',
  kitchen: '#F59E0B',
};

export function EmployeeAvatar({
  name,
  role,
  size = 26,
}: {
  name: string;
  role: string;
  size?: number;
}) {
  const bg = AVATAR_COLORS[role] ?? '#5A6485';
  // ~34% of diameter for readable initials at any size
  const initials =
    name
      .split(' ')
      .map((n) => n[0] ?? '')
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold font-sans shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.34, background: bg }}
    >
      {initials}
    </div>
  );
}

// ── Auth Photo Pane ───────────────────────────────────────────────────────────
export function AuthPhotoPane() {
  return (
    <div className="relative overflow-hidden hidden md:block">
      <div className="st-photo h-full w-full">
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(10,14,26,.55)] via-[rgba(10,14,26,.35)] to-[rgba(10,14,26,.75)]" />
        <div
          className="st-photo-brief"
          style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,.7))' }}
        >
          PHOTO 4K · Hospitality team in motion. Backlit window light, hands closing a check at
          counter, mid-service hum.
        </div>
      </div>

      {/* Floating proof card */}
      <div
        className="absolute left-10 bottom-14 w-80 p-[22px] border border-white/[0.08] rounded-lg backdrop-blur-[20px] backdrop-saturate-[140%]"
        style={{
          background: 'rgba(15,20,34,.75)',
          boxShadow: '0 32px 80px -20px rgba(0,0,0,.6)',
        }}
      >
        <div className="flex items-center gap-[6px] mb-3">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--st-gold)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
          </svg>
          <span className="st-eyebrow text-st-gold">This month, on SmartTips</span>
        </div>
        <div className="st-money text-[38px] leading-none" style={{ color: 'var(--st-gold)' }}>
          <span className="text-[22px] opacity-55 mr-0.5">$</span>
          <span className="font-medium">2,347,291</span>
          <span className="text-[20px] opacity-55">.00</span>
        </div>
        <div className="text-[12.5px] text-white/70 mt-[6px]">
          distributed fairly across <strong className="text-white">240 locations</strong>
        </div>
        <div className="flex items-center gap-2 mt-4 pt-[14px] border-t border-white/10">
          <div className="flex">
            {[
              { n: 'Léa Khalfi', r: 'bar' },
              { n: 'Marco Aslan', r: 'server' },
              { n: 'Aïcha Boudreau', r: 'host' },
              { n: 'Nora Caillet', r: 'kitchen' },
            ].map((p, i) => (
              <div
                key={p.n}
                className="rounded-full"
                style={{ marginLeft: i === 0 ? 0 : -8, boxShadow: '0 0 0 2px rgba(15,20,34,.85)' }}
              >
                <EmployeeAvatar name={p.n} role={p.r} size={26} />
              </div>
            ))}
          </div>
          <span className="text-[11.5px] text-white/60">+ 12,847 servers earning fairly</span>
        </div>
      </div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  rightSlot?: ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, rightSlot, className, ...rest },
  ref,
) {
  return (
    <label className="flex flex-col gap-[7px]">
      <span className="text-xs font-medium text-st-sec flex justify-between items-center">
        <span>{label}</span>
        {rightSlot}
      </span>
      <input
        ref={ref}
        className={cn(
          'st-focus px-[14px] py-[11px] bg-st-card border rounded-md text-st-hi font-sans text-sm outline-none transition-[border-color] w-full',
          error ? 'border-st-danger' : 'border-st-border',
          className,
        )}
        {...rest}
      />
      {error && <span className="text-[11.5px] text-st-danger">{error}</span>}
    </label>
  );
});

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 my-[22px]">
      <span className="flex-1 h-px bg-st-border" />
      <span className="st-eyebrow text-st-dim text-[10px]">{children}</span>
      <span className="flex-1 h-px bg-st-border" />
    </div>
  );
}

// ── OAuth Button ──────────────────────────────────────────────────────────────
export function OAuthBtn({
  icon,
  label,
  type = 'button',
}: {
  icon: ReactNode;
  label: string;
  type?: 'button' | 'submit' | 'reset';
}) {
  return (
    <button type={type} className="st-btn st-btn-ghost-dark flex-1 justify-center px-3 py-[10px]">
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ── Checkbox ──────────────────────────────────────────────────────────────────
export function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const toggle = () => onChange?.(!checked);
  const onKey = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  };
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={onKey}
      className={cn(
        'w-4 h-4 rounded-[4px] shrink-0 flex items-center justify-center transition-all cursor-pointer select-none',
        checked ? 'bg-st-indigo border border-st-indigo' : 'bg-st-raised border border-st-stroke',
      )}
    >
      {checked && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      )}
    </span>
  );
}

// ── Auth Footer ───────────────────────────────────────────────────────────────
export function AuthFooter() {
  return (
    <div className="flex items-center justify-between text-[11.5px] text-st-dim mt-8 shrink-0 flex-wrap gap-3">
      <span>© 2026 SmartTips Labs · Brooklyn</span>
      <div className="flex gap-3 items-center">
        <span className="inline-flex items-center gap-1">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--st-emerald)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          SOC 2 Type II
        </span>
        <span>·</span>
        <span>256-bit TLS</span>
        <span>·</span>
        <span>PCI DSS</span>
      </div>
    </div>
  );
}

// ── Inline SVGs ───────────────────────────────────────────────────────────────
export function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 11v3.2h5.2c-.2 1.3-1.5 3.8-5.2 3.8-3.1 0-5.7-2.6-5.7-5.8s2.6-5.8 5.7-5.8c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.5 3.8 14.4 3 12 3 6.9 3 2.8 7.1 2.8 12s4.1 9 9.2 9c5.3 0 8.8-3.7 8.8-9 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}

export function MicrosoftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path fill="#F25022" d="M3 3h8.5v8.5H3z" />
      <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" />
      <path fill="#00A4EF" d="M3 12.5h8.5V21H3z" />
      <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" />
    </svg>
  );
}
