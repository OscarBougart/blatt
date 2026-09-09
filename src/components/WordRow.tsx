import { Link } from 'react-router-dom';
import type { SavedWord } from '@/db/types';
import { truncateSentence } from '@/lib/words';

interface Props {
  word: SavedWord;
}

const rule = 'border-rule dark:border-lamp-gph/25';
const muted = 'text-graphite dark:text-lamp-gph';

/** One line in the list. Everything you can do to a word happens on its own page. */
export default function WordRow({ word }: Props) {
  return (
    <li className={`border-b ${rule}`}>
      <Link
        to={`/words/${word.id}`}
        className="flex min-h-14 w-full flex-col justify-center py-3 text-left"
      >
        <span className="flex items-baseline gap-2">
          <span className="text-lg" lang="de">
            {word.surface}
          </span>
          {word.lemma !== word.surface && (
            <span className={`type-en ${muted}`} lang="de">
              {word.lemma}
            </span>
          )}
        </span>
        <span className={`type-en mt-1 truncate ${muted}`} lang="de">
          {truncateSentence(word.sentence)}
        </span>
      </Link>
    </li>
  );
}
