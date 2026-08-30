import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_NEW_PER_DAY, clampNewPerDay } from '@/lib/queue';

/**
 * How many new words a day.
 *
 * The one setting that decides whether this app is still being used in three
 * months. Saving a word here costs a double-tap, so the natural brake that
 * stops people over-carding in Anki — the tedium of making the card — is gone,
 * and something has to take its place.
 */

const KEY = 'blatt:new-per-day';

function read(): number {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === null) return DEFAULT_NEW_PER_DAY;
    return clampNewPerDay(Number(stored));
  } catch {
    return DEFAULT_NEW_PER_DAY;
  }
}

interface PaceState {
  newPerDay: number;
  setNewPerDay: (value: number) => void;
}

const PaceContext = createContext<PaceState | null>(null);

export function PaceProvider({ children }: { children: ReactNode }) {
  const [newPerDay, setState] = useState(read);

  const setNewPerDay = useCallback((value: number) => {
    const next = clampNewPerDay(value);
    setState(next);
    try {
      localStorage.setItem(KEY, String(next));
    } catch {
      // Storage disabled. The setting holds for this session.
    }
  }, []);

  const value = useMemo(() => ({ newPerDay, setNewPerDay }), [newPerDay, setNewPerDay]);
  return <PaceContext.Provider value={value}>{children}</PaceContext.Provider>;
}

export function usePace(): PaceState {
  const state = useContext(PaceContext);
  if (!state) throw new Error('usePace must be used inside PaceProvider');
  return state;
}
