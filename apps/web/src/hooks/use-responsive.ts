/**
 * use-responsive — SSR-safe hook for adaptive behaviour based on viewport width.
 *
 * App is primarily used on phone/tablet, so components should adapt their
 * layout beyond what pure CSS media queries can do (e.g. conditional rendering).
 *
 * Implementation uses window.matchMedia to avoid layout-thrash from
 * window.innerWidth polling, and falls back to safe server-side defaults.
 *
 * Breakpoints mirror those in globals.css:
 *   sm  ≤ 640px  (phone)
 *   md  ≤ 768px  (small tablet)
 *   lg  ≤ 900px  (large tablet / small laptop)
 */
'use client';

import { useEffect, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ResponsiveState {
  /** Current named breakpoint */
  bp: Breakpoint;
  /** True when viewport ≤ 640px */
  isMobile: boolean;
  /** True when viewport ≤ 768px */
  isTablet: boolean;
  /** True when viewport ≤ 900px */
  isLargeTablet: boolean;
  /** True when a touch-primary device */
  isTouch: boolean;
}

// ── Server-side safe defaults (assumes desktop) ────────────────────────────────

const DEFAULT: ResponsiveState = {
  bp: 'xl',
  isMobile: false,
  isTablet: false,
  isLargeTablet: false,
  isTouch: false,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function compute(): ResponsiveState {
  if (typeof window === 'undefined') return DEFAULT;

  const w = window.innerWidth;
  let bp: Breakpoint;
  if (w <= 420) bp = 'xs';
  else if (w <= 640) bp = 'sm';
  else if (w <= 768) bp = 'md';
  else if (w <= 900) bp = 'lg';
  else bp = 'xl';

  return {
    bp,
    isMobile: w <= 640,
    isTablet: w <= 768,
    isLargeTablet: w <= 900,
    isTouch: window.matchMedia('(pointer: coarse)').matches,
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Returns responsive state that updates on window resize.
 * Safe to use in SSR: always hydrates from the client before first paint.
 */
export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(DEFAULT);

  useEffect(() => {
    // Initialise immediately on mount (avoids SSR mismatch by running client-side only)
    setState(compute());

    const mql = window.matchMedia('(max-width: 900px)');
    const handler = () => setState(compute());

    // Use addEventListener where available (Safari 14+ / all modern browsers)
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
    } else {
      // Fallback for older browsers
      mql.addListener(handler);
    }

    // Also watch resize for width changes not covered by a single mql
    window.addEventListener('resize', handler, { passive: true });

    return () => {
      if (typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', handler);
      } else {
        mql.removeListener(handler);
      }
      window.removeEventListener('resize', handler);
    };
  }, []);

  return state;
}
