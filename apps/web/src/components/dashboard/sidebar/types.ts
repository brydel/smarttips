import type { ComponentType, SVGProps } from 'react';

export type SidebarTone =
  | 'indigo'
  | 'emerald'
  | 'sky'
  | 'amber'
  | 'violet'
  | 'rose'
  | 'teal'
  | 'gold';

export interface SidebarCardData {
  href: string;
  label: string;
  caption: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: SidebarTone;
  /** Headline KPI rendered large (e.g. "+18%", "12", "—"). Null = unavailable. */
  metric: string | null;
  /** Secondary line under the metric (e.g. "vs la semaine dernière"). */
  hint?: string;
  /** Small badge in the top-right (e.g. "3" for AI insights). */
  badge?: string | null;
  /** Optional progress bar (0–1) for visual storytelling. */
  progress?: number | null;
}

export interface SidebarSectionData {
  label: string;
  items: SidebarCardData[];
}

/** Tone → tailwind class fragments. Kept in one place so cards stay consistent. */
export interface ToneTokens {
  /** Gradient applied as the card surface (very subtle, dark-mode friendly). */
  surface: string;
  /** Border colour in default state. */
  border: string;
  /** Icon container background. */
  iconBg: string;
  /** Icon colour. */
  iconText: string;
  /** Hover glow ring colour. */
  ringHover: string;
  /** Active border + glow. */
  activeRing: string;
  /** Solid accent for the metric / progress fill. */
  accent: string;
}

export const TONE_TOKENS: Record<SidebarTone, ToneTokens> = {
  indigo: {
    surface: 'bg-gradient-to-br from-[#1A1B3D]/80 via-[#0F1422]/60 to-[#0F1422]/0',
    border: 'border-[#3730A3]/40',
    iconBg: 'bg-[#4338CA]/30',
    iconText: 'text-[#A5B4FC]',
    ringHover:
      'group-hover:ring-[#6366F1]/40 group-hover:shadow-[0_8px_24px_-12px_rgba(99,102,241,0.5)]',
    activeRing: 'ring-1 ring-[#6366F1]/60 shadow-[0_8px_28px_-10px_rgba(99,102,241,0.45)]',
    accent: 'text-[#A5B4FC]',
  },
  emerald: {
    surface: 'bg-gradient-to-br from-[#064E3B]/70 via-[#0F1422]/60 to-[#0F1422]/0',
    border: 'border-[#10B981]/30',
    iconBg: 'bg-[#059669]/25',
    iconText: 'text-[#6EE7B7]',
    ringHover:
      'group-hover:ring-[#10B981]/40 group-hover:shadow-[0_8px_24px_-12px_rgba(16,185,129,0.45)]',
    activeRing: 'ring-1 ring-[#10B981]/60 shadow-[0_8px_28px_-10px_rgba(16,185,129,0.4)]',
    accent: 'text-[#6EE7B7]',
  },
  sky: {
    surface: 'bg-gradient-to-br from-[#0C4A6E]/75 via-[#0F1422]/60 to-[#0F1422]/0',
    border: 'border-[#0EA5E9]/30',
    iconBg: 'bg-[#0284C7]/25',
    iconText: 'text-[#7DD3FC]',
    ringHover:
      'group-hover:ring-[#0EA5E9]/40 group-hover:shadow-[0_8px_24px_-12px_rgba(14,165,233,0.45)]',
    activeRing: 'ring-1 ring-[#0EA5E9]/60 shadow-[0_8px_28px_-10px_rgba(14,165,233,0.4)]',
    accent: 'text-[#7DD3FC]',
  },
  amber: {
    surface: 'bg-gradient-to-br from-[#78350F]/65 via-[#0F1422]/60 to-[#0F1422]/0',
    border: 'border-[#F59E0B]/30',
    iconBg: 'bg-[#D97706]/25',
    iconText: 'text-[#FCD34D]',
    ringHover:
      'group-hover:ring-[#F59E0B]/40 group-hover:shadow-[0_8px_24px_-12px_rgba(245,158,11,0.45)]',
    activeRing: 'ring-1 ring-[#F59E0B]/60 shadow-[0_8px_28px_-10px_rgba(245,158,11,0.4)]',
    accent: 'text-[#FCD34D]',
  },
  violet: {
    surface: 'bg-gradient-to-br from-[#4C1D95]/70 via-[#0F1422]/60 to-[#0F1422]/0',
    border: 'border-[#A855F7]/30',
    iconBg: 'bg-[#7C3AED]/25',
    iconText: 'text-[#C4B5FD]',
    ringHover:
      'group-hover:ring-[#A855F7]/40 group-hover:shadow-[0_8px_24px_-12px_rgba(168,85,247,0.5)]',
    activeRing: 'ring-1 ring-[#A855F7]/60 shadow-[0_8px_28px_-10px_rgba(168,85,247,0.45)]',
    accent: 'text-[#C4B5FD]',
  },
  rose: {
    surface: 'bg-gradient-to-br from-[#881337]/65 via-[#0F1422]/60 to-[#0F1422]/0',
    border: 'border-[#F43F5E]/30',
    iconBg: 'bg-[#E11D48]/25',
    iconText: 'text-[#FDA4AF]',
    ringHover:
      'group-hover:ring-[#F43F5E]/40 group-hover:shadow-[0_8px_24px_-12px_rgba(244,63,94,0.45)]',
    activeRing: 'ring-1 ring-[#F43F5E]/60 shadow-[0_8px_28px_-10px_rgba(244,63,94,0.4)]',
    accent: 'text-[#FDA4AF]',
  },
  teal: {
    surface: 'bg-gradient-to-br from-[#134E4A]/70 via-[#0F1422]/60 to-[#0F1422]/0',
    border: 'border-[#14B8A6]/30',
    iconBg: 'bg-[#0D9488]/25',
    iconText: 'text-[#5EEAD4]',
    ringHover:
      'group-hover:ring-[#14B8A6]/40 group-hover:shadow-[0_8px_24px_-12px_rgba(20,184,166,0.45)]',
    activeRing: 'ring-1 ring-[#14B8A6]/60 shadow-[0_8px_28px_-10px_rgba(20,184,166,0.4)]',
    accent: 'text-[#5EEAD4]',
  },
  gold: {
    surface: 'bg-gradient-to-br from-[#78350F]/55 via-[#0F1422]/60 to-[#0F1422]/0',
    border: 'border-st-gold/30',
    iconBg: 'bg-st-gold/15',
    iconText: 'text-st-gold-glow',
    ringHover:
      'group-hover:ring-st-gold/40 group-hover:shadow-[0_8px_24px_-12px_rgba(212,165,116,0.45)]',
    activeRing: 'ring-1 ring-st-gold/60 shadow-[0_8px_28px_-10px_rgba(212,165,116,0.4)]',
    accent: 'text-st-gold-glow',
  },
};
