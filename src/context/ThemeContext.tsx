import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';

/** What the reader chose. `system` defers to the phone, now and from now on. */
export type ThemePreference = Theme | 'system';

export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;

const KEY = 'blatt:theme';
const DARK = '(prefers-color-scheme: dark)';

function systemTheme(): Theme {
  return window.matchMedia(DARK).matches ? 'dark' : 'light';
}

export function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Private mode, storage disabled. Fall through to the system preference.
  }
  // Anything else — never set, or written by an older build — means follow the
  // phone. The pre-paint script in index.html reads this key the same way.
  return 'system';
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#1a1714' : '#faf8f4');
}

interface ThemeState {
  /** What is on screen. */
  theme: Theme;
  /** What was asked for, which may be `system`. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readStoredPreference);
  const [system, setSystem] = useState<Theme>(systemTheme);

  // Watched always, not only while following it: a phone that turns dark at
  // dusk while the app is open should not be remembered wrong if the reader
  // switches back to `system` a moment later.
  useEffect(() => {
    const query = window.matchMedia(DARK);
    const onChange = () => setSystem(query.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const theme: Theme = preference === 'system' ? system : preference;

  useEffect(() => {
    apply(theme);
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, preference);
    } catch {
      // Nothing to do; the choice still holds for this session.
    }
  }, [preference]);

  const value = useMemo(
    () => ({ theme, preference, setPreference }),
    [theme, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const state = useContext(ThemeContext);
  if (!state) throw new Error('useTheme must be used inside ThemeProvider');
  return state;
}
