import { useEffect } from 'react';
import { requestPersistence } from '@/lib/backup';

/**
 * Ask the browser not to evict us, once per launch.
 *
 * Chrome grants this to an installed app without asking. iOS Safari mostly
 * does not, and evicts anyway — which is why the export in Settings exists and
 * is not treated as optional. This is the cheap half of the defence.
 */
export function usePersistentStorage() {
  useEffect(() => {
    void requestPersistence();
  }, []);
}
