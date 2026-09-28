import { useMemo } from 'react';
import type { Session } from '@/db/types';
import { flipsByText } from '@/lib/stats';

const muted = 'text-graphite dark:text-lamp-gph';

export interface TextFlipsProps {
  sessions: Session[];
  titles: Map<string, string>;
}

/**
 * Flips per text, most first. Which texts sent you to the English most, and
 * which you read without it: something to choose the next text by.
 */
export default function TextFlips({ sessions, titles }: TextFlipsProps) {
  const texts = useMemo(() => flipsByText(sessions), [sessions]);
  if (texts.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-lg">Texts</h2>
      <p className={`type-en ${muted}`}>Most flipped first</p>

      <ul className="mt-3">
        {texts.map(({ docId, flips }) => (
          <li
            key={docId}
            className="flex min-h-14 items-baseline justify-between gap-4 border-b border-rule py-3 dark:border-lamp-gph/25"
          >
            <span className="min-w-0 truncate">{titles.get(docId) ?? 'Deleted text'}</span>
            <span className="shrink-0 tabular-nums">
              {flips} <span className={`type-en ${muted}`}>{flips === 1 ? 'flip' : 'flips'}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
