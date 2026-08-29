import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Reading sizes.
 *
 * This control exists because `touch-action: manipulation` — needed so that
 * double-tap saves a word instead of zooming the page — also disables
 * pinch-zoom. Taking away the reader's ability to resize text and not giving
 * it back would be a bad trade.
 */
export const TYPE_SIZES = [16, 19, 22] as const;
export type TypeSize = (typeof TYPE_SIZES)[number];

const KEY = 'blatt:type-size';
const DEFAULT: TypeSize = 19;

function read(): TypeSize {
  try {
    const stored = Number(localStorage.getItem(KEY));
    if ((TYPE_SIZES as readonly number[]).includes(stored)) return stored as TypeSize;
  } catch {
    // Storage disabled. The default is fine.
  }
  return DEFAULT;
}

interface TypeSizeState {
  size: TypeSize;
  setSize: (size: TypeSize) => void;
}

const TypeSizeContext = createContext<TypeSizeState | null>(null);

export function TypeSizeProvider({ children }: { children: ReactNode }) {
  const [size, setSizeState] = useState<TypeSize>(read);

  useEffect(() => {
    document.documentElement.style.setProperty('--read-size', `${size}px`);
    try {
      localStorage.setItem(KEY, String(size));
    } catch {
      // Nothing to do; the size still applies for this session.
    }
  }, [size]);

  const setSize = useCallback((next: TypeSize) => setSizeState(next), []);
  const value = useMemo(() => ({ size, setSize }), [size, setSize]);

  return <TypeSizeContext.Provider value={value}>{children}</TypeSizeContext.Provider>;
}

export function useTypeSize(): TypeSizeState {
  const state = useContext(TypeSizeContext);
  if (!state) throw new Error('useTypeSize must be used inside TypeSizeProvider');
  return state;
}
