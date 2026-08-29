import type { Pair } from '@/db/types';
import GermanParagraph from './GermanParagraph';

interface Props {
  language: 'de' | 'en';
  pairs: Pair[];
  /** Whether this is the pane currently on screen. */
  active: boolean;
  /** The scrolling element, handed back for position tracking. */
  paneRef: (element: HTMLElement | null) => void;
  /** Per-paragraph ref, from the current-paragraph observer. */
  register: (index: number) => (element: HTMLElement | null) => void;
  savedKeys: Set<string>;
  exitingKeys: Set<string>;
}

/**
 * One full-screen column of one language.
 *
 * Two of these sit side by side on a track twice the width of the screen, and
 * only one is ever legible. The other is not merely off-screen: it is `inert`,
 * so it cannot be reached by keyboard, screen reader, or find-in-page. German
 * and English are never both available at once, and that has to hold for
 * every way of reading, not just for the eyes.
 */
export default function ReaderPane({
  language,
  pairs,
  active,
  paneRef,
  register,
  savedKeys,
  exitingKeys,
}: Props) {
  const german = language === 'de';

  return (
    <section
      ref={paneRef}
      aria-label={german ? 'German' : 'English'}
      aria-hidden={!active}
      {...{ inert: active ? undefined : '' }}
      className="relative h-full w-1/2 select-none overflow-y-auto overscroll-contain"
      // `manipulation` removes the browser's double-tap zoom, which would
      // otherwise fight the save gesture, and its 300ms click delay with it.
      // Settings carries the type-size control, because this also disables
      // pinch-zoom.
      style={{ touchAction: 'manipulation' }}
    >
      <article
        className={`mx-auto max-w-[34rem] px-7 pb-[40vh] pt-16 ${
          german ? 'text-ink dark:text-lamp-ink' : 'text-graphite dark:text-lamp-gph'
        }`}
      >
        {pairs.map((pair, i) =>
          german ? (
            <GermanParagraph
              key={i}
              text={pair.de}
              paragraphIndex={i}
              savedKeys={savedKeys}
              exitingKeys={exitingKeys}
              innerRef={register(i)}
            />
          ) : (
            <p key={i} lang="en" data-index={i} ref={register(i)} className="type-en-read mb-7">
              {pair.en}
            </p>
          ),
        )}
      </article>
    </section>
  );
}
