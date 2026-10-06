import { useEffect, useState, type MutableRefObject } from 'react';
import type { Doc, SavedWord } from '@/db/types';
import type { HeldWord } from '@/hooks/useWordHold';
import { placeBubble } from '@/lib/bubble';
import { lookupDefinition } from '@/lib/dict';

/** Two glosses are an answer; four are a dictionary page. */
const SHOWN = 2;

export interface DefinitionBubbleProps {
  /** The word being held, or null when nothing is. */
  held: HeldWord | null;
  bubbleRef: MutableRefObject<HTMLDivElement | null>;
  doc: Doc;
  /** Saved words by key: a saved word's own definition comes first. */
  saved: Map<string, SavedWord>;
}

/** Nothing held, nothing drawn. Split so the open bubble's hooks always run. */
export default function DefinitionBubble({ held, ...rest }: DefinitionBubbleProps) {
  if (!held) return null;
  return <OpenBubble key={held.key} held={held} {...rest} />;
}

type Lookup = { state: 'loading' } | { state: 'found'; lines: string[] } | { state: 'failed' };

/**
 * The definition of a held word, floating over the text without moving it.
 *
 * Drawn on the sill, the one surface in the app that is not the page, so it
 * reads as something laid on top of the text rather than part of it. No
 * shadow, as nowhere else has one: the edge does the separating.
 */
function OpenBubble({ held, bubbleRef, doc, saved }: DefinitionBubbleProps & { held: HeldWord }) {
  // The lemma was worked out at import, as for saving: a lookup, not analysis.
  const lemma = doc.lemmaMap?.[held.surface]?.[0]?.lemma ?? held.surface;
  const word = saved.get(held.key);
  const own = word?.note?.trim() || word?.definition;
  const [lookup, setLookup] = useState<Lookup>(own ? { state: 'found', lines: [own] } : { state: 'loading' });

  useEffect(() => {
    if (own) {
      setLookup({ state: 'found', lines: [own] });
      return;
    }
    let cancelled = false;
    setLookup({ state: 'loading' });
    // Cache first: every word of an imported text was looked up at import, so
    // this is normally a local read and works offline.
    void lookupDefinition(lemma)
      .then((entry) => {
        if (cancelled) return;
        setLookup(entry ? { state: 'found', lines: entry.definitions.slice(0, SHOWN) } : { state: 'failed' });
      })
      .catch(() => {
        if (!cancelled) setLookup({ state: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [lemma, own]);

  const place = placeBubble(held.rect, window.innerWidth);
  const edge = 'border-sill-edge bg-sill dark:border-lamp-sill-edge dark:bg-lamp-sill';

  return (
    <div
      ref={bubbleRef}
      role="status"
      aria-live="polite"
      // Taps on the bubble are the bubble's own: they must not reach the
      // double-tap on the text underneath.
      onClick={(event) => event.stopPropagation()}
      className={`card-in fixed z-20 rounded-sm border px-4 py-3 ${edge}`}
      style={{
        left: place.left,
        top: place.top,
        width: place.width,
        transform: place.above ? 'translateY(-100%)' : undefined,
      }}
    >
      {/* The pointer: a square turned on its corner, showing two edges. */}
      <span
        aria-hidden="true"
        className={`absolute h-2.5 w-2.5 rotate-45 ${edge} ${
          place.above ? '-bottom-[6px] border-b border-r' : '-top-[6px] border-l border-t'
        }`}
        style={{ left: place.arrowX - 5 }}
      />

      <p className="text-ink dark:text-lamp-ink" lang="de">
        {held.surface}
        {lemma !== held.surface && (
          <span className="type-en ml-2 text-graphite dark:text-lamp-gph">{lemma}</span>
        )}
      </p>

      <div className="type-en mt-1 text-graphite dark:text-lamp-gph">
        {lookup.state === 'loading' && <p>…</p>}
        {lookup.state === 'failed' && <p>No connection. Try again when you are online.</p>}
        {lookup.state === 'found' &&
          (lookup.lines.length === 0 ? (
            <p>No definition found.</p>
          ) : (
            lookup.lines.map((line) => <p key={line}>{line}</p>)
          ))}
      </div>
    </div>
  );
}
