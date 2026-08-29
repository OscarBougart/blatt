import { describe, expect, it } from 'vitest';
import {
  BACKUP_INTERVAL_MS,
  FORMAT,
  VERSION,
  backupFilename,
  backupIsStale,
  mergeById,
  parseBackup,
  shouldPromptBackup,
} from './backup';

const NOW = Date.UTC(2026, 7, 29);
const id = (item: { id: string }) => item.id;

describe('mergeById', () => {
  it('adds what is missing', () => {
    const result = mergeById([{ id: 'a' }], [{ id: 'b' }], id);
    expect(result.merged.map(id)).toEqual(['a', 'b']);
    expect(result.added).toBe(1);
  });

  it('never lets a backup overwrite live data', () => {
    const local = [{ id: 'a', reps: 7 }];
    const incoming = [{ id: 'a', reps: 0 }];
    const result = mergeById(local, incoming, id);
    expect(result.merged).toEqual([{ id: 'a', reps: 7 }]);
    expect(result.added).toBe(0);
  });

  it('keeps the local ordering, with additions appended', () => {
    const result = mergeById([{ id: 'b' }], [{ id: 'a' }, { id: 'b' }, { id: 'c' }], id);
    expect(result.merged.map(id)).toEqual(['b', 'a', 'c']);
    expect(result.added).toBe(2);
  });

  it('ignores duplicates inside the incoming set', () => {
    const result = mergeById([], [{ id: 'a' }, { id: 'a' }], id);
    expect(result.added).toBe(1);
  });

  it('restores everything into an emptied database', () => {
    const backup = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(mergeById([], backup, id).added).toBe(3);
  });
});

describe('parseBackup', () => {
  const valid = JSON.stringify({
    format: FORMAT,
    version: VERSION,
    exportedAt: NOW,
    docs: [{ id: 'd' }],
    words: [],
  });

  it('reads a backup and fills in absent tables', () => {
    const backup = parseBackup(valid);
    expect(backup.docs).toHaveLength(1);
    expect(backup.sessions).toEqual([]);
    expect(backup.forms).toEqual([]);
  });

  it('refuses text that is not JSON', () => {
    expect(() => parseBackup('nope')).toThrow(/not JSON/);
  });

  it('refuses JSON that is not a backup', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow(/not a Blatt backup/);
  });

  it('refuses a backup from a future version', () => {
    const future = JSON.stringify({ format: FORMAT, version: VERSION + 1 });
    expect(() => parseBackup(future)).toThrow(/newer version/);
  });
});

describe('backupIsStale', () => {
  it('is stale when it has never happened', () => {
    expect(backupIsStale(null, NOW)).toBe(true);
  });

  it('is not stale the day after an export', () => {
    expect(backupIsStale(NOW - 24 * 60 * 60 * 1000, NOW)).toBe(false);
  });

  it('is stale at fourteen days', () => {
    expect(backupIsStale(NOW - BACKUP_INTERVAL_MS, NOW)).toBe(true);
  });
});

describe('backupFilename', () => {
  it('sorts by date in a file list', () => {
    expect(backupFilename(NOW)).toBe('blatt-2026-08-29.json');
  });
});

describe('shouldPromptBackup', () => {
  const settled = {
    lastExport: null,
    oldestCreatedAt: NOW - 30 * 24 * 60 * 60 * 1000,
    savedWords: 40,
  };

  it('nags a reader with weeks of work and no backup', () => {
    expect(shouldPromptBackup(settled, NOW)).toBe(true);
  });

  it('says nothing to a first-time visitor', () => {
    expect(shouldPromptBackup({ ...settled, oldestCreatedAt: NOW }, NOW)).toBe(false);
  });

  it('says nothing when there is nothing saved to lose', () => {
    expect(shouldPromptBackup({ ...settled, savedWords: 0 }, NOW)).toBe(false);
  });

  it('says nothing when there is no library at all', () => {
    expect(shouldPromptBackup({ ...settled, oldestCreatedAt: null }, NOW)).toBe(false);
  });

  it('goes quiet after a recent export', () => {
    expect(shouldPromptBackup({ ...settled, lastExport: NOW - 1000 }, NOW)).toBe(false);
  });

  it('comes back a fortnight later', () => {
    const stale = { ...settled, lastExport: NOW - BACKUP_INTERVAL_MS };
    expect(shouldPromptBackup(stale, NOW)).toBe(true);
  });
});
