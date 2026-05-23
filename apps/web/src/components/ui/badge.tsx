import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type BadgeTone = 'indigo' | 'emerald' | 'gold' | 'neutral' | 'danger';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

const tones: Record<BadgeTone, string> = {
  indigo: 'bg-st-indigo/10 text-st-indigo-glow border-st-indigo/30',
  emerald: 'bg-st-emerald/10 text-st-emerald-glow border-st-emerald/30',
  gold: 'bg-st-gold/10 text-st-gold-glow border-st-gold/30',
  neutral: 'bg-st-raised text-st-sec border-st-stroke',
  danger: 'bg-st-danger/10 text-st-danger border-st-danger/30',
};

export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5',
        'text-[11.5px] font-medium font-sans rounded-pill border',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
