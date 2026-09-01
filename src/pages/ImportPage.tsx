import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Page from '@/components/Page';
import { db } from '@/db/db';
import { pairParagraphs, type PairResult } from '@/lib/pair';
import { newId } from '@/lib/id';
import { importDocument, type ImportProgress } from '@/lib/importDocument';
import { importBackup, parseBackup } from '@/lib/backup';
import { sharedOutcome, takeSharedCapture } from '@/lib/sharedCapture';

const field =
  'w-full min-h-12 border-b border-rule bg-transparent py-2 outline-none placeholder:text-graphite/60 focus:border-ink dark:border-lamp-gph/25 dark:placeholder:text-lamp-gph/60 dark:focus:border-lamp-ink';

export default function ImportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [de, setDe] = useState('');
  const [en, setEn] = useState('');
  const [warning, setWarning] = useState<PairResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [shared, setShared] = useState<string | null>(null);
  const claimed = useRef(false);

  /*
   * Arriving from the phone's share sheet. The worker has already parked the
   * file; this takes it, restores it, and — since a capture is one text —
   * opens it. Nothing here touches the paste form below, which stays usable
   * if the share turns out to be empty.
   */
  useEffect(() => {
    const outcome = sharedOutcome(location.search);
    if (outcome === 'none' || claimed.current) return;
    claimed.current = true;

    if (outcome !== 'ready') {
      setShared(
        outcome === 'empty'
          ? 'That share had no file in it.'
          : 'The shared file could not be read. Try Restore in Settings instead.',
      );
      navigate('/import', { replace: true });
      return;
    }

    void (async () => {
      setShared('Reading the shared file…');
      try {
        const text = await takeSharedCapture();
        if (text === null) throw new Error('Nothing was shared.');

        const backup = parseBackup(text);
        const summary = await importBackup(backup);

        if (backup.docs.length === 1) {
          navigate(`/read/${backup.docs[0].id}`, { replace: true });
          return;
        }
        setShared(
          `Imported ${summary.docs} texts, ${summary.words} words, ${summary.definitions} definitions.`,
        );
        navigate('/import', { replace: true });
      } catch (cause) {
        setShared(cause instanceof Error ? cause.message : 'That share could not be imported.');
        navigate('/import', { replace: true });
      }
    })();
  }, [location.search, navigate]);

  async function save(result: PairResult) {
    setSaving(true);
    setError(null);
    try {
      const id = newId();
      await db.docs.add({
        id,
        title: title.trim() || 'Ohne Titel',
        theme: theme.trim(),
        pairs: result.pairs,
        lemmaMap: {},
        lastParagraphIndex: 0,
        createdAt: Date.now(),
      });

      // Lemmatise and prefetch every definition in one pass, so there is no
      // half-imported state: when this returns, the text works offline.
      const lemmaMap = await importDocument(result.pairs, setProgress);
      await db.docs.update(id, { lemmaMap });

      navigate(`/read/${id}`);
    } catch (cause) {
      // The pasted text is still in the form. Say so rather than stranding
      // them on "Importing…".
      setError(cause instanceof Error ? cause.message : String(cause));
      setSaving(false);
      setProgress(null);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = pairParagraphs(de, en);
    if (result.pairs.length === 0) return;

    // A mismatch is shown once and must be acknowledged. Nothing is truncated
    // either way — the shorter side is padded.
    if (result.mismatch && !warning) {
      setWarning(result);
      return;
    }
    void save(result);
  }

  return (
    <Page title="Import">
      {shared && (
        <p role="status" className="type-en mb-6 text-graphite dark:text-lamp-gph">
          {shared}
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Title"
          className={field}
        />
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="Theme"
          aria-label="Theme tag"
          className={field}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="type-en text-graphite dark:text-lamp-gph">German</span>
            <textarea
              value={de}
              onChange={(e) => {
                setDe(e.target.value);
                setWarning(null);
              }}
              rows={12}
              lang="de"
              className={`${field} mt-2 resize-y font-[inherit]`}
            />
          </label>

          <label className="block">
            <span className="type-en text-graphite dark:text-lamp-gph">English</span>
            <textarea
              value={en}
              onChange={(e) => {
                setEn(e.target.value);
                setWarning(null);
              }}
              rows={12}
              className={`${field} mt-2 resize-y font-[inherit]`}
            />
          </label>
        </div>

        {warning && (
          <p role="alert" className="type-en text-ink dark:text-lamp-ink">
            {warning.deCount} German {warning.deCount === 1 ? 'paragraph' : 'paragraphs'},{' '}
            {warning.enCount} English. Nothing will be dropped — the shorter side is
            padded with blanks, and you can fix the gaps later. Submit again to save
            anyway.
          </p>
        )}

        {/* One bar for both passes: importing, or ready. No third state. */}
        {saving && progress && (
          <div aria-live="polite">
            <div className="h-px w-full bg-rule dark:bg-lamp-gph/25">
              <div
                className="h-px bg-ink transition-[width] duration-200 dark:bg-lamp-ink"
                style={{
                  width: `${Math.round((100 * progress.done) / Math.max(1, progress.total))}%`,
                }}
              />
            </div>
            <p className="type-en mt-3 text-graphite dark:text-lamp-gph">
              {progress.phase === 'lemmas' ? 'Reading words' : 'Fetching definitions'}
              {' — '}
              {progress.done} of {progress.total}
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="type-en text-ink dark:text-lamp-ink">
            Could not save: {error}. Your text is still here — try again.
          </p>
        )}

        <button
          type="submit"
          disabled={saving || (de.trim() === '' && en.trim() === '')}
          className="min-h-12 w-full border border-ink disabled:opacity-40 dark:border-lamp-ink"
        >
          {saving ? 'Importing…' : warning ? 'Save anyway' : 'Save'}
        </button>
      </form>
    </Page>
  );
}
