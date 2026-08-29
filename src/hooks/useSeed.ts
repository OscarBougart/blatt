import { useEffect } from 'react';
import { installSeed } from '@/lib/seed';

/** Install the demo document once, on first launch into an empty database. */
export function useSeed() {
  useEffect(() => {
    void installSeed();
  }, []);
}
