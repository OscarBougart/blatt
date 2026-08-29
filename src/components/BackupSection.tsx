import { useRef, useState } from 'react';
import {
  LAST_EXPORT_KEY,
  exportBackup,
  importBackup,
  lastExportAt,
  parseBackup,
  shareBackup,
} from '@/lib/backup';

const rule = 'border-rule dark:border-lamp-gph/25';
const muted = 'text-graphite dark:text-lamp-gph';

function formatWhen(at: number | null): string {
  if (at === null) return 'Never';
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

/**
 * Export and restore, in Settings.
 *
 * Everything the reader has — texts, words, review state, the dictionary cache
 * — goes into one JSON file. Restoring merges by id and never overwrites, so
 * importing an old backup into a live database can only add things back.
 */
export default function BackupSection() {
  const file = useRef<HTMLInputElement>(null);
  const [last, setLast] = useState<number | null>(() => lastExportAt());
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onExport() {
    setBusy(true);
    setStatus(null);
    try {
      const backup = await exportBackup();
      await shareBackup(backup);
      try {
        localStorage.setItem(LAST_EXPORT_KEY, String(backup.exportedAt));
      } catch {
        // Private mode. The file is saved, which is what mattered.
      }
      setLast(backup.exportedAt);
      setStatus(`Exported ${backup.docs.length} texts and ${backup.words.length} words.`);
    } catch {
      setStatus('Export failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onImport(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    // Cleared immediately, or choosing the same file twice fires nothing.
    event.target.value = '';
    if (!chosen) return;

    setBusy(true);
    setStatus(null);
    try {
      const summary = await importBackup(parseBackup(await chosen.text()));
      setStatus(
        `Restored ${summary.docs} texts, ${summary.words} words, ${summary.definitions} definitions.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg">Backup</h2>

      <p className={`type-en mt-2 ${muted}`}>
        Browsers delete stored data from sites they think are idle — iOS especially. A backup
        is the only copy that survives it.
      </p>

      <div className={`mt-4 flex items-center justify-between border-b ${rule}`}>
        <button
          type="button"
          onClick={() => void onExport()}
          disabled={busy}
          className="min-h-12 flex-1 text-left"
        >
          Export everything
        </button>
        <span className={`type-en ${muted}`}>{formatWhen(last)}</span>
      </div>

      <button
        type="button"
        onClick={() => file.current?.click()}
        disabled={busy}
        className={`flex min-h-12 w-full items-center border-b text-left ${rule}`}
      >
        Restore from a file
      </button>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        onChange={(event) => void onImport(event)}
        className="hidden"
      />

      {status && (
        <p role="status" className="type-en mt-3">
          {status}
        </p>
      )}
    </section>
  );
}
