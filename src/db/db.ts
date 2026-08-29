import Dexie, { type EntityTable } from 'dexie';
import type { DictEntry, Doc, FormEntry, SavedWord, Session } from './types';

export class BlattDB extends Dexie {
  docs!: EntityTable<Doc, 'id'>;
  words!: EntityTable<SavedWord, 'id'>;
  dict!: EntityTable<DictEntry, 'lemma'>;
  sessions!: EntityTable<Session, 'id'>;
  forms!: EntityTable<FormEntry, 'surface'>;

  constructor() {
    super('blatt');

    this.version(1).stores({
      docs: 'id, title, theme, createdAt',
      words: 'id, lemma, docId, dueAt, createdAt',
      dict: 'lemma, fetchedAt',
      sessions: 'id, docId, startedAt',
      lemmaMaps: 'docId',
    });

    this.version(2).stores({
      positions: 'docId',
    });

    // The reading position and the lemma map both belong on the Doc, per the
    // spec. Fold the two side tables back in before dropping them.
    this.version(3)
      .stores({ forms: 'surface, fetchedAt' })
      .upgrade(async (tx) => {
        const positions = await tx.table('positions').toArray();
        const byDoc = new Map<string, number>(
          positions.map((p) => [p.docId as string, (p.lastParagraphIndex as number) ?? 0]),
        );

        await tx.table('docs').toCollection().modify((doc) => {
          doc.lastParagraphIndex = byDoc.get(doc.id) ?? 0;
          doc.lemmaMap = doc.lemmaMap ?? {};
        });
      });

    // Dropped in a later version than the migration that read them, or Dexie
    // would delete the stores before the upgrade could copy anything out.
    this.version(4).stores({
      lemmaMaps: null,
      positions: null,
    });
  }
}

export const db = new BlattDB();
