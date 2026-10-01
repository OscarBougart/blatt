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
 * One full-screen column of one language. Two sit side by side on a track
 * twice the screen width.
 *
 * The off-screen pane is `inert`, not merely hidden: otherwise keyboard,
 * screen reader and find-in-page can all still reach the English.
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
      // pan-y: the browser scrolls vertically and leaves every horizontal drag
      // to useSwipe. `manipulation` allowed horizontal panning too, and Chrome
      // on Android then claimed the drag and cancelled the pointer after a few
      // pixels, long before a swipe could register, so the flip did nothing.
      // pan-y also kills double-tap zoom, which fights the save gesture, the
      // 300ms click delay, and pinch-zoom — hence the type-size control.
      style={{ touchAction: 'pan-y' }}
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
