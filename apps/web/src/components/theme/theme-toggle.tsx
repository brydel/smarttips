'use client';

import { memo } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useTheme, type ThemePreference } from '../../contexts/theme.context';

interface ThemeToggleOption {
  value: ThemePreference;
  label: string;
  Icon: typeof Sun;
}

const OPTIONS: readonly ThemeToggleOption[] = [
  { value: 'light', label: 'Clair', Icon: Sun },
  { value: 'system', label: 'Auto', Icon: Monitor },
  { value: 'dark', label: 'Sombre', Icon: Moon },
];

interface ThemeToggleProps {
  /** Override aria-label for assistive tech (defaults to "Thème de l'interface"). */
  ariaLabel?: string;
  /** Extra utility classes applied to the wrapper. */
  className?: string;
}

function ThemeToggleImpl({ ariaLabel = "Thème de l'interface", className }: ThemeToggleProps) {
  const { preference, setPreference, isHydrated } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex w-full items-center rounded-md border border-st-border bg-st-card p-0.5',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        // While unhydrated, no option is marked active — avoids server/client
        // mismatch when the persisted preference differs from the default.
        const active = isHydrated && preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={cn(
              'group flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1.5',
              'outline-none transition-colors duration-150',
              'focus-visible:ring-2 focus-visible:ring-st-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-st-bg',
              active ? 'bg-st-raised text-st-hi shadow-sm' : 'text-st-sec hover:text-st-pri',
            )}
          >
            <Icon
              width={13}
              height={13}
              aria-hidden="true"
              className={active ? 'text-st-indigo-glow' : undefined}
            />
            <span className="font-mono text-[10px] uppercase tracking-wider">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const ThemeToggle = memo(ThemeToggleImpl);
