import { useLiveQuery } from 'dexie-react-hooks';
import { usePace } from '@/context/PaceContext';
import { db } from '@/db/db';
import { MAX_NEW_PER_DAY, MIN_NEW_PER_DAY, isWaiting } from '@/lib/queue';

const rule = 'border-rule dark:border-lamp-gph/25';
const muted = 'text-graphite dark:text-lamp-gph';

/**
 * The pace control, and the size of the queue behind it.
 *
 * The number of words waiting is shown plainly and never dressed up. Four
 * hundred words in the queue is not a backlog to feel guilty about — it is
 * four hundred words that were worth stopping for, arriving at a rate that can
 * actually be learned. A badge or a warning colour here would turn the honest
 * reading habit this app is built around into something to avoid.
 */
export default function PaceSection() {
  const { newPerDay, setNewPerDay } = usePace();

  const waiting = useLiveQuery(
    async () => (await db.words.toArray()).filter(isWaiting).length,
    [],
    0,
  );

  return (
    <section className="mt-10">
      <h2 className="text-lg">Pace</h2>

      <p className={`type-en mt-2 ${muted}`}>
        Saving a word here costs one tap, so nothing stops you saving eighty in an evening.
        This is what keeps them from all arriving at once.
      </p>

      <div className={`mt-4 flex min-h-12 items-center justify-between border-b ${rule}`}>
        <span>New words a day</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setNewPerDay(newPerDay - 1)}
            disabled={newPerDay <= MIN_NEW_PER_DAY}
            aria-label="Fewer new words a day"
            className={`min-h-12 min-w-12 ${newPerDay <= MIN_NEW_PER_DAY ? 'opacity-30' : ''}`}
          >
            −
          </button>
          <span className="min-w-8 text-center tabular-nums">{newPerDay}</span>
          <button
            type="button"
            onClick={() => setNewPerDay(newPerDay + 1)}
            disabled={newPerDay >= MAX_NEW_PER_DAY}
            aria-label="More new words a day"
            className={`min-h-12 min-w-12 ${newPerDay >= MAX_NEW_PER_DAY ? 'opacity-30' : ''}`}
          >
            +
          </button>
        </div>
      </div>

      <div className={`flex min-h-12 items-center justify-between border-b ${rule}`}>
        <span className={muted}>Waiting to be introduced</span>
        <span className={`tabular-nums ${muted}`}>{waiting}</span>
      </div>
    </section>
  );
}
