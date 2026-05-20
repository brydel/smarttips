'use client';

import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

// ── Logo ─────────────────────────────────────────────────────────────────────
export function LogoMark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: 'linear-gradient(135deg, var(--st-indigo) 0%, #4338CA 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(99,102,241,.4)',
        }}
      >
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
      <span
        style={{
          fontFamily: 'var(--st-font-display)',
          fontSize: 16,
          color: 'var(--st-d-9)',
          letterSpacing: '-0.02em',
          fontWeight: 400,
        }}
      >
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
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.34,
        color: 'white',
        fontWeight: 600,
        fontFamily: 'var(--st-font-ui)',
      }}
    >
      {initials}
    </div>
  );
}

// ── Auth Photo Pane ───────────────────────────────────────────────────────────
export function AuthPhotoPane() {
  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="st-photo" style={{ height: '100%', width: '100%' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(135deg, rgba(10,14,26,.55) 0%, rgba(10,14,26,.35) 50%, rgba(10,14,26,.75) 100%)',
          }}
        />
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
        style={{
          position: 'absolute',
          left: 40,
          bottom: 56,
          width: 320,
          padding: 22,
          background: 'rgba(15,20,34,.75)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 'var(--st-r-lg)',
          boxShadow: '0 32px 80px -20px rgba(0,0,0,.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
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
          <span className="st-eyebrow" style={{ color: 'var(--st-gold)' }}>
            This month, on SmartTips
          </span>
        </div>
        <div className="st-money" style={{ fontSize: 38, color: 'var(--st-gold)', lineHeight: 1 }}>
          <span style={{ fontSize: 22, opacity: 0.55, marginRight: 2 }}>$</span>
          <span style={{ fontWeight: 500 }}>2,347,291</span>
          <span style={{ fontSize: 20, opacity: 0.55 }}>.00</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', marginTop: 6 }}>
          distributed fairly across <strong style={{ color: 'white' }}>240 locations</strong>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 16,
            paddingTop: 14,
            borderTop: '1px solid rgba(255,255,255,.1)',
          }}
        >
          <div style={{ display: 'flex' }}>
            {[
              { n: 'Léa Khalfi', r: 'bar' },
              { n: 'Marco Aslan', r: 'server' },
              { n: 'Aïcha Boudreau', r: 'host' },
              { n: 'Nora Caillet', r: 'kitchen' },
            ].map((p, i) => (
              <div
                key={i}
                style={{
                  marginLeft: i === 0 ? 0 : -8,
                  borderRadius: '50%',
                  boxShadow: '0 0 0 2px rgba(15,20,34,.85)',
                }}
              >
                <EmployeeAvatar name={p.n} role={p.r} size={26} />
              </div>
            ))}
          </div>
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)' }}>
            + 12,847 servers earning fairly
          </span>
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
  { label, error, rightSlot, style, ...rest },
  ref,
) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span
        style={{
          fontSize: 12,
          color: 'var(--st-d-7)',
          fontWeight: 500,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{label}</span>
        {rightSlot}
      </span>
      <input
        ref={ref}
        className="st-focus"
        style={{
          padding: '11px 14px',
          background: 'var(--st-d-1)',
          border: `1px solid ${error ? 'var(--st-danger)' : 'var(--st-d-3)'}`,
          borderRadius: 'var(--st-r-md)',
          color: 'var(--st-d-9)',
          fontFamily: 'var(--st-font-ui)',
          fontSize: 14,
          outline: 'none',
          transition: 'border .15s',
          width: '100%',
          boxSizing: 'border-box',
          ...style,
        }}
        {...rest}
      />
      {error && <span style={{ fontSize: 11.5, color: 'var(--st-danger)' }}>{error}</span>}
    </label>
  );
});

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0' }}>
      <span style={{ flex: 1, height: 1, background: 'var(--st-d-3)' }} />
      <span className="st-eyebrow" style={{ color: 'var(--st-d-6)', fontSize: 10 }}>
        {children}
      </span>
      <span style={{ flex: 1, height: 1, background: 'var(--st-d-3)' }} />
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
    <button
      type={type}
      className="st-btn st-btn-ghost-dark"
      style={{ flex: 1, justifyContent: 'center', padding: '10px 12px' }}
    >
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
  return (
    <span
      onClick={() => onChange?.(!checked)}
      style={{
        width: 16,
        height: 16,
        borderRadius: 4,
        flexShrink: 0,
        background: checked ? 'var(--st-indigo)' : 'var(--st-d-2)',
        border: `1px solid ${checked ? 'var(--st-indigo)' : 'var(--st-d-4)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all .15s',
      }}
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 11.5,
        color: 'var(--st-d-6)',
        marginTop: 32,
        flexShrink: 0,
      }}
    >
      <span>© 2026 SmartTips Labs · Brooklyn</span>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
