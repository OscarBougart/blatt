/**
 * The page half of the share target.
 *
 * The service worker parks a shared file in a cache and redirects here; this
 * takes it out again. Taking is destructive on purpose — a bundle must import
 * once, not once per reload of /import.
 */

const SHARE_CACHE = 'blatt-share';
const SHARE_KEY = '/shared-capture';

/** What the worker put in the query string when it redirected. */
export type SharedOutcome = 'none' | 'ready' | 'empty' | 'failed';

export function sharedOutcome(search: string): SharedOutcome {
  const value = new URLSearchParams(search).get('shared');
  if (value === '1') return 'ready';
  if (value === 'empty') return 'empty';
  if (value === 'failed') return 'failed';
  return 'none';
}

/** The shared file's text, removed from the cache. Null if there is none. */
export async function takeSharedCapture(): Promise<string | null> {
  if (!('caches' in globalThis)) return null;
  try {
    const cache = await caches.open(SHARE_CACHE);
    const response = await cache.match(SHARE_KEY);
    if (!response) return null;
    const text = await response.text();
    await cache.delete(SHARE_KEY);
    return text;
  } catch {
    return null;
  }
}
