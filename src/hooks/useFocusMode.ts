import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

/** What the Shell hands to the page inside it. */
export interface ShellContext {
  /** Hide the tab bar, so the page has the screen to itself. */
  setFocused: (focused: boolean) => void;
}

/**
 * Take the tab bar away while `focused` is true, and give it back when the
 * page leaves. For a review round: with the destinations out of sight, the
 * cards are the only thing on screen, and the back arrow is the way out.
 */
export function useFocusMode(focused: boolean): void {
  const { setFocused } = useOutletContext<ShellContext>();

  useEffect(() => {
    setFocused(focused);
    return () => setFocused(false);
  }, [focused, setFocused]);
}
