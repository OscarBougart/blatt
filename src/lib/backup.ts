import { db } from '@/db/db';
import type { DictEntry, Doc, FormEntry, SavedWord, Session } from '@/db/types';

/**
 * Whole-database export and restore.
 *
 * This is not a nice-to-have. iOS Safari evicts IndexedDB from sites it
 * decides are idle, and `navigator.storage.persist()` is not reliably honoured
 * there — so the only durable copy of a year of reading is one the reader has
 * taken out of the browser themselves.
 */

export const FORMAT = 'blatt-backup';
export const VERSION = 1;

/** Nag after this long without an export. */
export const BACKUP_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;

export const LAST_EXPORT_KEY = 'blatt:lastExport';

export interface Backup {
  format: typeof FORMAT;
  version: number;
  exportedAt: number;
  docs: Doc[];
  words: SavedWord[];
  dict: DictEntry[];
  sessions: Session[];
  forms: FormEntry[];
}

export interface MergeResult<T> {
  merged: T[];
  added: number;
  kept: number;
}

/**
 * Union by key, with what is already here winning every collision.
 *
 * A restore must never be able to destroy work. If a word exists in both
 * copies, the live one has the more recent review state — the backup is older
 * by definition — so the backup only ever fills in what is missing.
 */
export function mergeById<T>(local: T[], incoming: T[], key: (item: T) => string): MergeResult<T> {
  const seen = new Set(local.map(key));
  const merged = local.slice();
  let added = 0;

  for (const item of incoming) {
    const id = key(item);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(item);
    added++;
  }

  return { merged, added, kept: local.length };
}

/**
 * Read a backup file, refusing anything that is not one.
 *
 * Throws rather than returning null: an import that quietly did nothing would
 * be indistinguishable from one that worked, which is the worst possible
 * outcome for the one feature standing between the reader and data loss.
 */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file is not JSON.');
  }

  const backup = raw as Partial<Backup>;
  if (backup?.format !== FORMAT) throw new Error('That is not a Blatt backup.');
  if (typeof backup.version !== 'number' || backup.version > VERSION) {
    throw new Error('That backup was made by a newer version of Blatt.');
  }

  return {
    format: FORMAT,
    version: backup.version,
    exportedAt: backup.exportedAt ?? 0,
    docs: backup.docs ?? [],
    words: backup.words ?? [],
    dict: backup.dict ?? [],
    sessions: backup.sessions ?? [],
    forms: backup.forms ?? [],
  };
}

/** Has it been too long? */
export function backupIsStale(lastExport: number | null, now: number): boolean {
  if (lastExport === null) return true;
  return now - lastExport >= BACKUP_INTERVAL_MS;
}

export interface PromptInput {
  lastExport: number | null;
  /** When the reader's oldest document was created. Null if there are none. */
  oldestCreatedAt: number | null;
  savedWords: number;
}

/**
 * Whether to nag about backing up.
 *
 * Staleness alone is not enough. A backup is never fresh on day one, and a
 * first-time visitor who has read two paragraphs of the demo has nothing to
 * lose and no reason to be handed a chore. So the prompt waits until there is
 * both something worth keeping and a fortnight of use behind it.
 */
export function shouldPromptBackup(input: PromptInput, now: number): boolean {
  if (input.savedWords === 0) return false;
  if (input.oldestCreatedAt === null) return false;
  if (now - input.oldestCreatedAt < BACKUP_INTERVAL_MS) return false;
  return backupIsStale(input.lastExport, now);
}

export function lastExportAt(): number | null {
  try {
    const raw = localStorage.getItem(LAST_EXPORT_KEY);
    const at = raw === null ? NaN : Number(raw);
    return Number.isFinite(at) ? at : null;
  } catch {
    return null;
  }
}

/** blatt-2026-08-29.json — sorts correctly in a file list. */
export function backupFilename(at: number): string {
  return `blatt-${new Date(at).toISOString().slice(0, 10)}.json`;
}

export async function exportBackup(): Promise<Backup> {
  const [docs, words, dict, sessions, forms] = await Promise.all([
    db.docs.toArray(),
    db.words.toArray(),
    db.dict.toArray(),
    db.sessions.toArray(),
    db.forms.toArray(),
  ]);

  return { format: FORMAT, version: VERSION, exportedAt: Date.now(), docs, words, dict, sessions, forms };
}

export interface ImportSummary {
  docs: number;
  words: number;
  definitions: number;
  sessions: number;
}

/**
 * Merge a backup into the live database.
 *
 * One transaction across every table: a restore that half-applied would leave
 * words pointing at documents that were never written.
 */
export async function importBackup(backup: Backup): Promise<ImportSummary> {
  return db.transaction('rw', [db.docs, db.words, db.dict, db.sessions, db.forms], async () => {
    const merge = async <T>(
      table: { toArray: () => Promise<T[]>; bulkPut: (rows: T[]) => Promise<unknown> },
      incoming: T[],
      key: (item: T) => string,
    ) => {
      const local = await table.toArray();
      const { merged, added } = mergeById(local, incoming, key);
      if (added > 0) await table.bulkPut(merged.slice(local.length));
      return added;
    };

    const docs = await merge(db.docs, backup.docs, (d) => d.id);
    const words = await merge(db.words, backup.words, (w) => w.id);
    const definitions = await merge(db.dict, backup.dict, (e) => e.lemma);
    const sessions = await merge(db.sessions, backup.sessions, (s) => s.id);
    await merge(db.forms, backup.forms, (f) => f.surface);

    return { docs, words, definitions, sessions };
  });
}

/**
 * Hand the file to the OS: the share sheet on a phone, a download elsewhere.
 *
 * The share sheet matters more than it looks. It is the only route from an
 * installed iOS web app to Files or iCloud, and a plain download inside a
 * standalone PWA on iOS often goes nowhere the reader can find.
 */
export async function shareBackup(backup: Backup): Promise<void> {
  const json = JSON.stringify(backup);
  const name = backupFilename(backup.exportedAt);
  const file = new File([json], name, { type: 'application/json' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (error) {
      // A cancelled share sheet is not a failure, and must not fall through to
      // a download the reader did not ask for.
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** Ask for storage that survives eviction. Best effort; iOS often says no. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
