import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * How many in-app entries sit behind this one. React Router keeps the count in
 * history state; a cold start, a shared link, or a replace from either leaves
 * it at 0.
 */
function entriesBehind(): number {
  const state: unknown = window.history.state;
  if (state && typeof state === 'object' && 'idx' in state && typeof state.idx === 'number') {
    return state.idx;
  }
  return 0;
}

/**
 * Go back to `parent`, the way the phone's own back button would.
 *
 * Navigating *to* the parent pushed a new entry instead, and on Android the
 * system back button then walked through every screen already left: swipe out
 * of a text, press back, and you were reading it again.
 *
 * When there is an in-app screen behind this one, step back to it. When there
 * is not (a cold start, the share sheet), replace this screen with the parent
 * rather than stack the parent on top — or step back out of the app entirely.
 */
export function useBack(parent: string) {
  const navigate = useNavigate();

  return useCallback(() => {
    if (entriesBehind() > 0) void navigate(-1);
    else void navigate(parent, { replace: true });
  }, [navigate, parent]);
}
