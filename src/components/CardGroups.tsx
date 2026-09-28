import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ReviewLog, SavedWord } from '@/db/types';
import { CARD_GROUPS, CARD_GROUP_LABEL, countGroups, lastGrades } from '@/lib/cardGroups';

const muted = 'text-graphite dark:text-lamp-gph';

export interface CardGroupsProps {
  words: SavedWord[];
  logs: ReviewLog[];
}

/**
 * Saved words by the grade last given to each. Every row with words in it
 * opens the word list filtered to that group.
 *
 * The bars are graphite, like the review strip: amber is spent on the flip
 * rate, and a Hard card is a card coming back sooner, not a warning.
 */
export default function CardGroups({ words, logs }: CardGroupsProps) {
  const counts = useMemo(() => countGroups(words, lastGrades(logs)), [words, logs]);

  if (words.length === 0) return null;
  const largest = Math.max(...CARD_GROUPS.map((group) => counts[group]), 1);

  return (
    <section className="mt-10">
      <h2 className="text-lg">Flashcards</h2>
      <p className={`type-en ${muted}`}>By the grade you last gave each word</p>

      <ul className="mt-3">
        {CARD_GROUPS.map((group) => {
          const count = counts[group];
          const row = (
            <>
              <span className="w-36 shrink-0">{CARD_GROUP_LABEL[group]}</span>
              <span className="w-8 shrink-0 text-right tabular-nums">{count}</span>
              <span className="ml-3 flex h-2 flex-1 items-center" aria-hidden>
                <span
                  className="h-full rounded-sm bg-graphite dark:bg-lamp-gph"
                  style={{ width: count === 0 ? 1 : `${(count / largest) * 100}%` }}
                />
              </span>
            </>
          );

          return (
            <li key={group} className="type-en">
              {count === 0 ? (
                <span className={`flex min-h-12 items-center ${muted}`}>{row}</span>
              ) : (
                <Link
                  to={`/words?grade=${group}`}
                  aria-label={`${CARD_GROUP_LABEL[group]}: ${count} ${count === 1 ? 'word' : 'words'}`}
                  className="flex min-h-12 items-center"
                >
                  {row}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
