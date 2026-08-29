import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Page from '@/components/Page';
import { db } from '@/db/db';
import { pairParagraphs, type PairResult } from '@/lib/pair';
import { newId } from '@/lib/id';
import { importDocument, type ImportProgress } from '@/lib/importDocument';

const field =
  'w-full min-h-12 border-b border-rule bg-transparent py-2 outline-none placeholder:text-graphite/60 focus:border-ink dark:border-lamp-gph/25 dark:placeholder:text-lamp-gph/60 dark:focus:border-lamp-ink';

export default function ImportPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [de, setDe] = useState('');
  const [en, setEn] = useState('');
  const [warning, setWarning] = useState<PairResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

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

      // Lemmatise, then prefetch every definition the document needs, as one
      // pass. When this finishes the document is fully readable offline —
      // there is no half-imported state to explain.
      const lemmaMap = await importDocument(result.pairs, setProgress);
      await db.docs.update(id, { lemmaMap });

      navigate(`/read/${id}`);
    } catch (cause) {
      // Whatever went wrong, the text the user just pasted is still in the
      // form. Say so, and let them try again — never strand them on "Saving…".
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

        {/* One bar for both passes. The document is either ready to read
            offline or still importing; there is no third state. */}
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
