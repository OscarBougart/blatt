import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Doc } from '@/db/types';
import { deleteDoc } from '@/lib/corrections';

interface Props {
  doc: Doc;
  savedWords: number;
  /** Whether the library is in editing mode, showing removal controls. */
  editing: boolean;
}

const muted = 'text-graphite dark:text-lamp-gph';

/** How long "Remove" waits for a second tap before backing out. */
const CONFIRM_MS = 4000;

/**
 * One text in the library, and the only place a text can be deleted.
 *
 * Two taps rather than a modal. Deleting a text takes its saved words and its
 * reading history with it, which is too much to lose to one stray tap.
 */
export default function DocRow({ doc, savedWords, editing }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  // Derived rather than stored, so leaving edit mode disarms it too. It also
  // times out below — a control left armed is a trap for the next person.
  const armed = confirming && editing;

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  async function onRemove() {
    if (!armed) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    await deleteDoc(doc.id);
  }

  const subtitle = [doc.theme, savedWords > 0 ? `${savedWords} ${savedWords === 1 ? 'word' : 'words'}` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex items-center gap-3 border-b border-rule dark:border-lamp-gph/25">
      <Link to={`/read/${doc.id}`} className="flex min-h-14 flex-1 flex-col justify-center py-2">
        <span className="text-lg">{doc.title}</span>
        <span className={`type-en ${muted}`}>{subtitle}</span>
      </Link>

      {editing && (
        <button
          type="button"
          onClick={() => void onRemove()}
          disabled={busy}
          // Ink, not `signal` — that colour is spent on the flip rate.
          className={`min-h-12 shrink-0 px-2 text-[15px] ${
            armed ? 'text-ink dark:text-lamp-ink' : muted
          }`}
        >
          {armed ? 'Really remove' : 'Remove'}
        </button>
      )}
    </li>
  );
}
