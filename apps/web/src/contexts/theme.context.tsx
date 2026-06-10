'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// ── Public types ──────────────────────────────────────────────────────────────

export const THEME_PREFS = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFS)[number];

export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  /** User preference — what the toggle reflects ('system' included). */
  preference: ThemePreference;
  /** Resolved theme actually applied (system → light|dark). */
  resolvedTheme: ResolvedTheme;
  /** Update preference + persist to localStorage. */
  setPreference: (next: ThemePreference) => void;
  /** True while React is still hydrating (use to avoid mismatched UI). */
  isHydrated: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'smarttips:theme';
const NO_TRANSITION_CLASS = 'st-no-transition';
const SYSTEM_MEDIA_QUERY = '(prefers-color-scheme: light)';

// ── Type guard ───────────────────────────────────────────────────────────────

function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFS as readonly string[]).includes(value);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Read persisted preference, narrowed via type guard. */
function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isThemePreference(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

/** Best-effort persist; silently no-ops when storage is denied. */
function persistPreference(value: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* Storage denied (private mode, sandbox) — runtime state still updates. */
  }
}

function resolveSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  try {
    return window.matchMedia(SYSTEM_MEDIA_QUERY).matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(resolved: ResolvedTheme, preference: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  // Disable transitions for the duration of the swap (avoids colour bleed
  // across multiple animated children).
  root.classList.add(NO_TRANSITION_CLASS);
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-pref', preference);
  // Two RAFs ensure the new tokens are committed before re-enabling transitions.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      root.classList.remove(NO_TRANSITION_CLASS);
    });
  });
}

// ── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // SSR-safe defaults — the inline /theme-init.js has already set the correct
  // attribute on <html> before this component mounts, so we never repaint.
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');
  const [isHydrated, setHydrated] = useState(false);

  // Track the listener so SSR/StrictMode double-effects don't leak.
  const mqlRef = useRef<MediaQueryList | null>(null);

  // First-paint hydration — sync state with whatever the init script applied.
  useEffect(() => {
    const stored = readStoredPreference();
    const resolved = stored === 'system' ? resolveSystemTheme() : stored;
    setPreferenceState(stored);
    setResolvedTheme(resolved);
    setHydrated(true);
  }, []);

  // Subscribe to system theme changes when (and only when) preference = system.
  useEffect(() => {
    if (preference !== 'system') {
      mqlRef.current = null;
      return;
    }
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mql = window.matchMedia(SYSTEM_MEDIA_QUERY);
    mqlRef.current = mql;
    const handler = (event: MediaQueryListEvent): void => {
      const next: ResolvedTheme = event.matches ? 'light' : 'dark';
      setResolvedTheme(next);
      applyTheme(next, 'system');
    };
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
    } else {
      // Safari 13 fallback
      mql.addListener(handler);
    }
    return () => {
      if (typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', handler);
      } else {
        mql.removeListener(handler);
      }
    };
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference): void => {
    if (!isThemePreference(next)) return; // defensive — runtime narrows input
    const resolved = next === 'system' ? resolveSystemTheme() : next;
    setPreferenceState(next);
    setResolvedTheme(resolved);
    persistPreference(next);
    applyTheme(resolved, next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedTheme,
      setPreference,
      isHydrated,
    }),
    [preference, resolvedTheme, setPreference, isHydrated],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Hook — throws when used outside the provider so misuse fails loudly. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
